"use strict"

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
		function bindVars(boundVars, normalizers) {
			return (i, element) => {
				const [ lastKey, parentObj, ] = xbind._digObj(boundVars, $(element).attr("xb-bind-on"))
				const binder = xbind.binders.find(binder => binder.is(element))
				const normalizer = normalizers[lastKey] || (val => val)

				// register getter/setter
				Object.defineProperty(parentObj, lastKey, {
					enumerable: !lastKey.startsWith("_"),
					configurable: true,
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

		$("[xb-bind-on]").each(bindVars(boundVars, normalizers))
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
