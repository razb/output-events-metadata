const os = require('os')
const fs = require('fs')
const merge = require('merge-deep')
const xml2js = require('xml2js')
const xmlparser = new xml2js.Parser()
const safeEval = require('safe-eval')
let storemeta = undefined
let xmlmeta = undefined

function getStoreMeta(debug, auto) {
    if (debug) console.warn('Initializing store metadata')
    storemeta = {}
    let hostname = os.hostname()
    //let hostname = 'US12345WST25'
    let offset = (new Date().getTimezoneOffset())
    let ip = undefined
    let interfaces = os.networkInterfaces()
    let regex = auto.ipmatch ? new RegExp(auto.ipmatch) : new RegExp(/10\..*/)
    if (interfaces && Object.keys(interfaces) && Object.keys(interfaces).length > 0) {
        Object.keys(interfaces).map( x => {
        let interface = interfaces[x]
        interface = interface.find(x => x.address && regex.test(x.address) && !x.address.includes('10.0.'))
        if (interface) ip = interface.address
        })
        }
    if (hostname && typeof(hostname) == 'string') {
        if (hostname.length === 12) {
            storemeta.store = {
                number: hostname.substr(2, 5),
                utcOffset: offset
            }
            storemeta.device = {
                type: hostname.substr(7, 3),
                number: hostname.substr(10, 2)
            }
            storemeta.country = hostname.substr(0, 2)
        }
        storemeta.host = {
            name: hostname,
        }
        ip && (storemeta.host.ip = ip);
    }
    return storemeta
}
async function getXMLMeta(file, keys, debug) {
    let xml = fs.readFileSync(file, 'utf8')
    try {
        let data = await xmlparser.parseStringPromise(xml)
        let object, obj = {}
        keys.map(key => {
            if (debug) {
                console.log(key)
            }
            let context = {
                "xml": data
            }
            let source = key.source
            let value = safeEval(source, context)
            if (debug) console.log(value)
            if (value && value[0]) {
                object = objValue(key.field, value[0])
                if (debug) console.log(object);
            }
            obj = merge(obj, object)
        })
        if (debug) console.log(obj)
        return obj;
    } catch (err) {
        console.log(err)
        return {}
    }
}

async function eventsCustomMeta(context, config, eventEmitter, data, callback) {
    let meta = config.meta || false
    let tags = config.tags || false
    let parse = config.parse || false
    let xml = config.xml || false
    let debug = config.debug || false
    let mapping = config.mapping || false
    let levels = config.levels || false
    if (data === undefined) {
        return callback(new Error('data is null'), null)
    }
    try {
        if (meta) {
            if (Object.keys(meta).length > 0) {
                Object.keys(meta).map(key => {
                    if (key !== 'auto') {
                        if (!data[key]) data[key] = meta[key]
                    }
                })
            }
            if (meta.auto) {
                storemeta = storemeta || getStoreMeta(debug, meta.auto)
                if (storemeta) {
                    Object.keys(storemeta).map(key => {
                        if (!data[key]) data[key] = storemeta[key]
                    })
                }
            }
        }
        if (debug && !xmlmeta) console.log('xml', xml);
        if (xml && xml.file && xml.attributes && xml.attributes.length > 0) {
            let file = xml.file
            let attributes = xml.attributes;
            xmlmeta = xmlmeta || await getXMLMeta(file, attributes, debug)
            try {
                if (xmlmeta && Object.keys(xmlmeta).length > 0) {
                    data = merge(data, xmlmeta)
                }
            } catch (err) {
                console.log(err);
            }
        }
        if (tags && tags.length > 0) {
            let match, matchValue, matched = false;
            tags.map(tag => {
                if (tag.field && tag.match && tag.key && tag.value) {
                    let fieldName = tag.field
                    matchValue = fieldName.split('.').length > 1 ? data[fieldName.split('.')[0]][fieldName.split('.')[1]] : data[fieldName] || ''
                    match = new RegExp(tag.match)
                    if (match.test(matchValue)) {
                        matched = true;
                    } else {
                        matched = false;
                    }
                    if (matched) {
                        if (tag.key.split('.').length > 1) {
                            if (data[tag.key.split('.')[0]] && Object.keys(data[tag.key.split('.')[0]]) && Object.keys(data[tag.key.split('.')[0]]).length > 0) {
                                data[tag.key.split('.')[0]][tag.key.split('.')[1]] = tag.value
                            } else {
                                data[tag.key.split('.')[0]] = {}
                                data[tag.key.split('.')[0]][tag.key.split('.')[1]] = tag.value
                            }
                        } else {
                            data[tag.key] = tag.value
                        }
                    }
                }
            });
            if (debug) console.log('matched', matched, data);
        }
        if (mapping && Object.keys(mapping).length > 0) {
            let mapped = {}
            Object.keys(mapping).map(key => {
                if (data[key]) {
                    let val = mapping[key]
                    if (val.split('.').length > 1) {
                        let newkey = val.split('.')[0];
                        if (!data[newkey] || mapped[newkey]) {
                            if (!data[newkey]) {
                                data[newkey] = {}
                                data[newkey][val.split('.')[1]] = data[key];
                                delete data[key]
                                mapped[newkey] = true
                            } else {
                                data[newkey][val.split('.')[1]] = data[key]
                                delete data[key]
                            }
                        }
                    } else {
                        if (!data[val]) {
                            data[val] = data[key]
                            delete data[key]
                        }
                    }
                }
            })
        }
        if (parse && !data.parsed && data.service && data.service.name && parse[data.service.name]) {
        let parserules = parse[data.service.name]
        let delimiter = parserules.delimiter
        let event = {}
        let message = data.message.split(delimiter)
        if (message.length === parserules.attributes.length ) {
        if ( debug ) console.log('Applying parsing rules for ' + data.service.name)
        parserules.attributes.map( (x,i) => {
        event[x.field] = message[i]
            let context = {
                "event": event
            }
        if ( x.rule ) event[x.field] = safeEval(x.rule, context)
        })
        event.parsed = true;
        data = {...data, ...event}
        }
        }
        if (data.message && !data.level) {
            data.level = data.message.toLowerCase().indexOf('error') >= 0 ? 'ERROR' : data.message.toLowerCase().indexOf('warn') >= 0 ? 'WARNING' : 'INFO'
        }
        if (data && data.level && levels) {
            levels.map(x => {
                if (data.level.toUpperCase().indexOf(x) >= 0) data.level = x
            })
        }
        if (debug) console.log(data)
        return callback(null, data)
    } catch (ex) {
        console.log(data, 'exception', ex)
        return callback(null, data)
    }
}

function objValue(key, value) {
    let object = {}
    let result = object
    var arr = key.split('.');
    for (var i = 0; i < arr.length - 1; i++) {
        object = object[arr[i]] = {};
    }
    object[arr[arr.length - 1]] = value;
    return result;
}
module.exports = eventsCustomMeta
