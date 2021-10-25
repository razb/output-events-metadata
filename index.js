const os = require('os')
function getStoreMeta () {
let storemeta = {}
let hostname = os.hostname()
let ip = undefined
let interfaces = os.networkInterfaces()
let regex = new RegExp(/10\..*/)
if ( interfaces && Object.keys(interfaces) && Object.keys(interfaces).length > 0 ) {
interfaces = Object.keys(interfaces).map( x => interfaces[x][0])
let interface = interfaces.find( x => regex.test(x.address))
if ( interface ) ip = interface.address
}
if ( hostname && typeof(hostname) == 'string' && hostname.length == 12 ) {
storemeta.store = { number: hostname.substr(2,5)}
storemeta.device = { type: hostname.substr(7,3), number: hostname.substr(10,2) }
storemeta.country = hostname.substr(0,2)
storemeta.host = { name: hostname, ip: ip }
}
return storemeta
}
function eventsCustomMeta(context, config, eventEmitter, data, callback) {
    let meta = config.meta || false
    let tags = config.tags || false
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
                    if ( key !== 'auto') {
                    if (!data[key]) data[key] = meta[key]
                    }
                })
            }
        let storemeta = getStoreMeta()
        console.log(storemeta);
        if ( storemeta && meta.auto ) {
        Object.keys(storemeta).map( key => {
                    if (!data[key]) data[key] = storemeta[key]
        })
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
module.exports = eventsCustomMeta
