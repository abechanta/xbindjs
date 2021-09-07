"use strict"

class xbindParser {

	static _digObj(target, reference) {
		const refs = reference.split(".")
		return {
			key: refs.pop(),
			obj: refs.reduce((obj, key) => obj[key] = obj[key] || {}, target),
		}
	}

	static _resolveReference(aliases, reference) {
		const [ refTop, ] = reference.split(".")
		if (refTop.startsWith("$") && aliases.hasOwnProperty(refTop)) {
			return [ aliases[refTop], reference.replace(`${refTop}.`, ""), ]
		}
		return [ aliases[undefined], reference, ]
	}

	static syntax = {
		"x": (element, attr, aliases) => {
			const pattern = /\s*(\$?[.\w]+)\s*/
			const expression = $(element).attr(attr)
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
			const expression = $(element).attr(attr)
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
			const expression = $(element).attr(attr)
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

class xbindArray {

	constructor(onpush) {
		this.onpush = onpush
		Object.defineProperty(this, "contents", {
			value: [],
		})
		Object.defineProperty(this, "length", {
			get: () => this.contents.length,
		})
	}

	push(...objs) {
		for (let obj of objs) {
			const boundVars = {}
			const idx = this.contents.length
			this.contents.push(boundVars)
			Object.defineProperty(this, idx, {
				// configurable: true,
				get: () => this.contents[idx],
				set: val => this.contents[idx] = val,
			})
			this.onpush(boundVars)
			xbind._assignObj(boundVars, obj)
		}
	}

	// TODO

	// pop() {
	// 	const idx = this.contents.length - 1
	// 	delete this[idx]
	// 	return this.contents.pop()
	// }
}

class xbind {

	static _assignObj(dst, src) {
		for (let key in src) {
			if (typeof(src[key]) === "object") {
				if (typeof(dst[key]) === "object") {
					xbind._assignObj(dst[key], src[key])
				}
			} else {
				dst[key] = src[key]
			}
		}
	}

	static binders = [
		{
			name: "checkbox",
			is: element => $(element).is("input[type=checkbox]"),
			binder: element => { return {
				get: () => $(element).is(":checked"),
				set: val => $(element).prop("checked", val),
			}},
		},
		{
			name: "input",
			is: element => $(element).is("input, textarea"),
			binder: (element, normalizer) => { return {
				get: () => normalizer($(element).val()),
				set: val => $(element).val(val),
			}},
		},
		{
			name: "property",
			is: element => $(element).is("[xb-affect-to]"),
			binder: element => { return {
				get: () => $(element).prop($(element).attr("xb-affect-to")),
				set: val => $(element).prop($(element).attr("xb-affect-to"), val),
			}},
		},
		{
			name: "innerText",
			is: () => true,
			binder: element => { return {
				get: () => $(element).text(),
				set: val => $(element).text(val),
			}},
		},
	]

	static cloners = {
		"xb-present-if": {
			parse: (element, aliases) => xbindParser.syntax["not_x"](element, "xb-present-if", aliases),
			setter: (obj, key, task) => () => {
				Object.defineProperty(obj, key, {
					enumerable: !key.startsWith("_"),
					// configurable: true,
					set: task,
				})
			},
		},

		"xb-repeat-for": {
			parse: (element, aliases) => xbindParser.syntax["x_in_y"](element, "xb-repeat-for", aliases),
			setter: (obj, key, task) => () => {
				obj[key] = new xbindArray(task)
			},
		},
	}

	static bind(boundVars, normalizers) {

		function bindVars(aliases, normalizers) {
			return (i, element) => {
				// parse directive attr
				const dataB = xbindParser.syntax["x"](element, "xb-bind-on", aliases)
				const binder = xbind.binders.find(binder => binder.is(element))
				const normalizer = normalizers[dataB.target.key] || (val => val)

				// register getter/setter
				Object.defineProperty(dataB.target.obj, dataB.target.key, {
					enumerable: !dataB.target.key.startsWith("_"),
					// configurable: true,
					...binder.binder(element, normalizer),
				})

				// register onchange handler for input element
				if (normalizers[dataB.target.key]) {
					$(element).change(() => {
						dataB.target.obj[dataB.target.key] = dataB.target.obj[dataB.target.key].trim()
					})
				}
			}
		}

		function parseBlocks(aliases) {
			return (i, element) => {
				// parse directive attr
				const dataI = xbind.cloners["xb-present-if"].parse(element, aliases)
				const dataR = xbind.cloners["xb-repeat-for"].parse(element, aliases)
				const clonerI = () => {
					const clone = cloneBlock(element.content.cloneNode(true), aliases, {})
					element.parentNode.insertBefore(clone, element)
				}
				const clonerR = boundVars => {
					const clone = cloneBlock(element.content.cloneNode(true), aliases, { [dataR.iterator]: boundVars, })
					element.parentNode.insertBefore(clone, element)
				}

				if (dataI) {
					const task = dataR ? xbind.cloners["xb-repeat-for"].setter(dataR.target.obj, daraR.target.key, clonerR) : clonerI
					const taskWrapper = dataI.inversion ? val => !val && task() : val => val && task()

					// register getter/setter
					const setterWrapper = xbind.cloners["xb-present-if"].setter(dataI.target.obj, dataI.target.key, taskWrapper)
					setterWrapper()
				} else {
					// register onpush handler for adding element
					const setterWrapper = xbind.cloners["xb-repeat-for"].setter(dataR.target.obj, dataR.target.key, clonerR)
					setterWrapper()
				}
			}
		}

		function cloneBlock(fragment, aliases, alias) {
			const directives = Object.keys(xbind.cloners).map(str => `[${str}]`).join(",")
			const aliasesNext = Object.assign({}, aliases, alias)
			$("[xb-bind-on]", fragment).each(bindVars(aliasesNext, normalizers))
			$(directives, fragment).each(parseBlocks(aliasesNext))
			return fragment
		}

		cloneBlock(document, {}, { undefined: boundVars, })
	}

	static build(params) {
		const xb = window.xbind || {
			boundVars: {},
			normalizers: params?.normalizers || {},
		}
		xbind.bind(xb.boundVars, xb.normalizers)
		window.xbind = xb
		return xb.boundVars
	}
}
