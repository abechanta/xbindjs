"use strict"

function assignObj(dst, src) {
	for (let key in src) {
		if (typeof(src[key]) === "object") {
			if (typeof(dst[key]) === "object") {
				assignObj(dst[key], src[key])
			}
		} else {
			dst[key] = src[key]
		}
	}
}

module.exports = {
	assignObj,
}
