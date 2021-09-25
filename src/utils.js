"use strict"

export function assignObj(dst, src) {
	for (const key in src) {
		if (typeof(src[key]) === "object") {
			if (typeof(dst[key]) === "object") {
				assignObj(dst[key], src[key])
			}
		} else {
			dst[key] = src[key]
		}
	}
}
