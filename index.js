"use strict"

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

	push(...appendVarsList) {
		for (let appendVars of appendVarsList) {
			const boundVars = {}
			const idx = this.contents.length
			this.contents.push(boundVars)
			Object.defineProperty(this, idx, {
				// configurable: true,
				get: () => this.contents[idx],
				set: val => this.contents[idx] = val,
			})
			this.onpush(boundVars)
			xbind._assignObj(boundVars, appendVars)
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
	static _digObj(targetObj, refVar) {
		const refKeys = refVar.split(".")
		return [ refKeys.pop(), refKeys.reduce((obj, name) => obj[name] = obj[name] || {}, targetObj), ]
	}

	static _digValue(targetObj, refVar) {
		const refKeys = refVar.split(".")
		return refKeys.reduce((obj, name) => obj.hasOwnProperty(name) ? obj[name] : [], targetObj || {})
	}

	static _assignObj(dstObj, srcObj) {
		for (let entry in srcObj) {
			if (typeof(srcObj[entry]) === "object") {
				if (typeof(dstObj[entry]) === "object") {
					xbind._assignObj(dstObj[entry], srcObj[entry])
				}
			} else {
				dstObj[entry] = srcObj[entry]
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

	static templateHandlers = {
		// TODO

		// "xb-present-if": {
		// 	parse: element => {
		// 		const expression = $(element).attr("xb-present-if")
		// 		if (!expression) {
		// 			return [ undefined, true, ]
		// 		}
		// 		const inversion = expression.startsWith("not ")
		// 		const refVar = inversion ? expression.replace("not ", "") : expression
		// 		return [ refVar, inversion, ]
		// 	},
		// },

		"xb-repeat-for": {
			parse: element => {
				const expression = $(element).attr("xb-repeat-for")
				const matches = expression?.match(/\s*(\$\w+)\s+in\s+(\$?[.\w]+)\s*/)
				return matches ? [ matches[2], matches[1], ] : [ undefined, [] ]
			},
		},
	}

	static preprocessors = {
		"xb-pp-present-if": {
			parse: (targetObj, element) => {
				const expression = $(element).attr("xb-pp-present-if")
				if (!expression) {
					return [ undefined, true, ]
				}
				const inversion = expression.startsWith("not ")
				const refVar = inversion ? expression.replace("not ", "") : expression
				return [ refVar, inversion === !xbind._digValue(targetObj, refVar), ]
			},
		},
		"xb-pp-repeat-for": {
			parse: (targetObj, element) => {
				const expression = $(element).attr("xb-pp-repeat-for")
				if (!expression) {
					return [ undefined, [] ]
				}
				const [ aliasVar, refVar, ] = expression.split(" in ").map(str => str.trim())
				return [ refVar, xbind._digValue(targetObj, refVar)?.map((e, i) => {
					return { [aliasVar]: `${refVar}.${i}`, }
				}) || [], ]
			},
		},
	}

	static preprocess(paramVars) {
		function cloneBlock(element, aliasVars, refVars) {
			const clone = element.content.cloneNode(true)

			// mark as cloned
			refVars.forEach(refVar => {
				$(clone).children().attr("xb-pp-cloned", refVar)
			})

			// replace alias name (the first segment of bind-on varName) into referenced name
			$("[xb-bind-on]", clone).each((i, element) => {
				const refVar = $(element).attr("xb-bind-on")
				const [ refKeyTop, ] = refVar.split(".")
				if (refKeyTop.startsWith("$") && aliasVars.hasOwnProperty(refKeyTop)) {
					$(element).attr("xb-bind-on", refVar.replace(refKeyTop, aliasVars[refKeyTop]))
				}
			})

			return clone
		}

		function cloneBlocks(paramVars, aliasVars) {
			return (i, element) => {
				// parse directive attr
				const [ refVarI, condition, ] = xbind.preprocessors["xb-pp-present-if"].parse(paramVars, element)
				const [ refVarR, aliasVarList, ] = xbind.preprocessors["xb-pp-repeat-for"].parse(paramVars, element)

				if (refVarI && condition && !refVarR) {
					aliasVarList.push({})
				}

				// clone template fragments
				for (let aliasVar of aliasVarList) {
					const aliasVarsNext = Object.assign({}, aliasVars, aliasVar)
					const refVars = [ refVarI, refVarR, ].reduce((cur, e) => e ? cur.push(e) && cur : cur, [])
					const clone = cloneBlock(element, aliasVarsNext, refVars)
					const allDirectives = Object.keys(xbind.preprocessors).map(str => `[${str}]`).join(",")
					$(allDirectives, clone).each(cloneBlocks(paramVars, aliasVarsNext))
					element.parentNode.insertBefore(clone, element)
				}
			}
		}

		const allDirectives = Object.keys(xbind.preprocessors).map(str => `[${str}]`).join(",")
		$(allDirectives).each(cloneBlocks(paramVars, {}))
	}

	static bind(boundVars, normalizers) {
		const allDirectives = Object.keys(xbind.templateHandlers).map(str => `[${str}]`).join(",")

		function resolveReference(aliasVars, refVar) {
			const [ refKeyTop, ] = refVar.split(".")
			if (refKeyTop.startsWith("$") && aliasVars.hasOwnProperty(refKeyTop)) {
				return [ aliasVars[refKeyTop], refVar.replace(`${refKeyTop}.`, ""), ]
			}
			return [ aliasVars[undefined], refVar, ]
		}

		function bindVars(aliasVars, normalizers) {
			return (i, element) => {
				// parse directive attr
				const refVar = $(element).attr("xb-bind-on")
				const [ lastKey, parentObj, ] = xbind._digObj(...resolveReference(aliasVars, refVar))
				const binder = xbind.binders.find(binder => binder.is(element))
				const normalizer = normalizers[lastKey] || (val => val)

				// register getter/setter
				Object.defineProperty(parentObj, lastKey, {
					enumerable: !lastKey.startsWith("_"),
					// configurable: true,
					...binder.binder(element, normalizer),
				})

				// register onchange handler for input element
				if (normalizers[lastKey]) {
					$(element).change(() => {
						parentObj[lastKey] = parentObj[lastKey].trim()
					})
				}
			}
		}

		function parseBlocks(aliasVars) {
			return (i, element) => {
				// parse directive attr
				// const [ refVarI, condition, ] = xbind.templateHandlers["xb-present-if"].parse(element)
				const [ refVarR, aliasVar, ] = xbind.templateHandlers["xb-repeat-for"].parse(element)
				const [ lastKey, parentObj, ] = xbind._digObj(...resolveReference(aliasVars, refVarR))

				// register onpush handler for adding element
				parentObj[lastKey] = new xbindArray(boundVars => {
					const aliasVarsNext = Object.assign({}, aliasVars, { [aliasVar]: boundVars, })
					const clone = element.content.cloneNode(true)
					$("[xb-bind-on]", clone).each(bindVars(aliasVarsNext, normalizers))
					$(allDirectives, clone).each(parseBlocks(aliasVarsNext))

					element.parentNode.insertBefore(clone, element)
				})
			}
		}

		const aliasVars = { undefined: boundVars, }
		const parent = document
		$("[xb-bind-on]", parent).each(bindVars(aliasVars, normalizers))
		$(allDirectives, parent).each(parseBlocks(aliasVars))
	}

	static build(params) {
		const xb = window.xbind || {
			boundVars: {},
			paramVars: params || {},
			normalizers: params?._normalizers || {},
		}
		Object.assign(xb.paramVars, params)
		xbind.preprocess(xb.paramVars)
		xbind.bind(xb.boundVars, xb.normalizers)
		xbind._assignObj(xb.boundVars, xb.paramVars)
		window.xbind = xb
		return xb.boundVars
	}
}
