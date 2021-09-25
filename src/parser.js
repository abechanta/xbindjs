"use strict"

const dom7 = require("dom7")
const $$ = dom7.$
$$.fn.attr = dom7.attr

export class xbindParser {

	static _digObj(target, reference) {
		const refs = reference.split(".")
		const key = refs.pop()
		const obj = refs.reduce((obj, key) => obj[key] = obj[key] || {}, target)
		return { key, obj, }
	}

	static _resolveReference(aliases, reference) {
		const [ ref0, ] = reference.split(".")
		if (ref0.startsWith("$") && aliases.hasOwnProperty(ref0)) {
			return [ aliases[ref0], reference.replace(`${ref0}.`, ""), ]
		}
		return [ aliases[undefined], reference, ]
	}

	static syntax = {
		"x": (element, attr, aliases) => {
			const pattern = /\s*(\$?[.\w]+)\s*/
			const expression = $$(element).attr(attr)
			const matches = expression?.match(pattern)
			if (!matches) {
				return undefined
			}
			return {
				reference: matches[1],	// x
				target: xbindParser._digObj(...xbindParser._resolveReference(aliases, matches[1])),
			}
		},

		"not_x": (element, attr, aliases) => {
			const pattern = /\s*(not\s+)?(\$?[.\w]+)\s*/
			const expression = $$(element).attr(attr)
			const matches = expression?.match(pattern)
			if (!matches) {
				return undefined
			}
			return {
				reference: matches[2],		// x
				inversion: !!matches[1],	// not?
				target: xbindParser._digObj(...xbindParser._resolveReference(aliases, matches[2])),
			}
		},

		"x_in_y": (element, attr, aliases) => {
			const pattern = /\s*(\$\w+)\s+in\s+(\$?[.\w]+)\s*/
			const expression = $$(element).attr(attr)
			const matches = expression?.match(pattern)
			if (!matches) {
				return undefined
			}
			return {
				reference: matches[2],	// y
				iterator: matches[1],	// x
				target: xbindParser._digObj(...xbindParser._resolveReference(aliases, matches[2])),
			}
		},
	}
}
