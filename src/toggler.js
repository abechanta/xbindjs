"use strict"

class xbindToggler {

	constructor(onset, onreset) {
		Object.defineProperty(this, "_onset", {
			value: onset,
		})
		Object.defineProperty(this, "_onreset", {
			value: onreset,
		})
	}

	nofity(valOld, valNew) {
		!valOld && valNew && this._onset()
		valOld && !valNew && this._onreset()
	}
}

module.exports = xbindToggler
