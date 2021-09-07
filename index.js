"use strict"

const parse_not_x = /\s*(not\s+)?(\$?[.\w]+)\s*/
const parse_x_in_y = /\s*(\$\w+)\s+in\s+(\$?[.\w]+)\s*/

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
		"xb-present-if": {
			parse: element => {
				const expression = $(element).attr("xb-present-if")
				const matches = expression?.match(parse_not_x)
				return matches ? [ matches[2], !!matches[1], ] : [ undefined, true, ]
			},
			setterWrapper: (targetObj, key, task) => () => {
				Object.defineProperty(targetObj, key, {
					enumerable: !key.startsWith("_"),
					// configurable: true,
					set: task,
				})
			},
		},

		"xb-repeat-for": {
			parse: element => {
				const expression = $(element).attr("xb-repeat-for")
				const matches = expression?.match(parse_x_in_y)
				return matches ? [ matches[2], matches[1], ] : [ undefined, [] ]
			},
			setterWrapper: (targetObj, key, task) => () => {
				targetObj[key] = new xbindArray(task)
			},
		},
	}

	static bind(boundVars, normalizers) {
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

		function cloneBlock(fragment, aliasVars, aliasVar) {
			const allDirectives = Object.keys(xbind.templateHandlers).map(str => `[${str}]`).join(",")
			const aliasVarsNext = Object.assign({}, aliasVars, aliasVar)
			$("[xb-bind-on]", fragment).each(bindVars(aliasVarsNext, normalizers))
			$(allDirectives, fragment).each(parseBlocks(aliasVarsNext))
			return fragment
		}

		function parseBlocks(aliasVars) {
			return (i, element) => {
				// parse directive attr
				const [ refVarI, inversion, ] = xbind.templateHandlers["xb-present-if"].parse(element)
				const [ lastKeyI, parentObjI, ] = refVarI ? xbind._digObj(...resolveReference(aliasVars, refVarI)) : []
				const [ refVarR, aliasVar, ] = xbind.templateHandlers["xb-repeat-for"].parse(element)
				const [ lastKeyR, parentObjR, ] = refVarR ? xbind._digObj(...resolveReference(aliasVars, refVarR)) : []

				const clonerI = () => {
					const clone = cloneBlock(element.content.cloneNode(true), aliasVars, {})
					element.parentNode.insertBefore(clone, element)
				}
				const clonerR = boundVars => {
					const clone = cloneBlock(element.content.cloneNode(true), aliasVars, { [aliasVar]: boundVars, })
					element.parentNode.insertBefore(clone, element)
				}

				if (refVarI) {
					const task = refVarR ? xbind.templateHandlers["xb-repeat-for"].setterWrapper(parentObjR, lastKeyR, clonerR) : clonerI
					const taskWrapper = inversion ? val => !val && task() : val => val && task()

					// register getter/setter
					const setterWrapperI = xbind.templateHandlers["xb-present-if"].setterWrapper(parentObjI, lastKeyI, taskWrapper)
					setterWrapperI()
				} else {
					// register onpush handler for adding element
					const setterWrapperR = xbind.templateHandlers["xb-repeat-for"].setterWrapper(parentObjR, lastKeyR, clonerR)
					setterWrapperR()
				}
			}
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
