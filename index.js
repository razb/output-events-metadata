function eventsCustomMeta(context, config, eventEmitter, data, callback) {
    let meta = config.meta || false
    let debug = config.debug || false
    let mapping = config.mapping || false
    if (data === undefined) {
        return callback(new Error('data is null'), null)
    }
    try {
        if (data && meta) {
            if (Object.keys(meta).length > 0) {
                Object.keys(meta).map(key => {
                    if (!data[key]) data[key] = meta[key]
                })
                if (Object.keys(mapping).length > 0) {
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
                if (data.message && !data.level ) {
                data.level = data.message.toLowerCase().indexOf('error') >= 0 ? 'ERROR' : data.message.toLowerCase().indexOf('warn') >= 0 ? 'WARNING' : 'INFO'
                }
                if (debug) console.log(data)
                return callback(null, data)
            }
        } else {
                if (data.message && !data.level ) {
                data.level = data.message.toLowerCase().indexOf('error') >= 0 ? 'ERROR' : data.message.toLowerCase().indexOf('warn') >= 0 ? 'WARNING' : 'INFO'
                }
            return callback(null, data)
        }
    } catch (ex) {
        console.log(data, 'exception', ex)
        return callback(null, data)
    }
}
module.exports = eventsCustomMeta
