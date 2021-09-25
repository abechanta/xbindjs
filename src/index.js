"use strict"

const xbindParser = require("./parser")
const xbindToggler = require("./toggler")
const xbindContainer = require("./container")
const dom7 = require("dom7")
const $$ = dom7.$
$$.fn.attr = dom7.attr
$$.fn.children = dom7.children
$$.fn.data = dom7.data
$$.fn.each = dom7.each
$$.fn.insertBefore = dom7.insertBefore
$$.fn.is = dom7.is
$$.fn.on = dom7.on
$$.fn.prev = dom7.prev
$$.fn.prop = dom7.prop
$$.fn.remove = dom7.remove
$$.fn.text = dom7.text
$$.fn.trigger = dom7.trigger
$$.fn.val = dom7.val

class xbind {

	static binders = [
		{
			name: "checkbox",
			is: element => $$(element).is("input[type=checkbox]"),
			binder: element => { return {
				get: () => $$(element).is(":checked"),
				set: val => $$(element).prop("checked", val),
			}},
		},
		{
			name: "input",
			is: element => $$(element).is("input, select, textarea"),
			binder: (element, normalizer) => { return {
				get: () => normalizer($$(element).val()),
				set: val => $$(element).val(normalizer(val)),
			}},
		},
		{
			name: "property",
			is: element => $$(element).is("[xb-affect-to]"),
			binder: element => { return {
				get: () => $$(element).attr($$(element).attr("xb-affect-to")),
				set: val => $$(element).attr($$(element).attr("xb-affect-to"), val),
			}},
		},
		{
			name: "innerText",
			is: () => true,
			binder: element => { return {
				get: () => $$(element).text(),
				set: val => $$(element).text(val),
			}},
		},
	]

	static cloners = {
		"xb-present-if": {
			parse: (element, aliases) => xbindParser.syntax["not_x"](element, "xb-present-if", aliases),
			bind: (target, handler) => () => {
				Object.defineProperty(target.obj, `\$${target.key}`, {
					configurable: true,
					value: handler,
				})
				Object.defineProperty(target.obj, target.key, {
					enumerable: !target.key.startsWith("_"),
					configurable: true,
					get: () => this[target.key],
					set: val => handler.nofity(this[target.key], val) || (this[target.key] = val),
				})
			},
			unbind: target => {
				Object.defineProperty(target.obj, target.key, {
					get: undefined,
					set: undefined,
				})
				delete target.obj[target.key]
			},
		},

		"xb-repeat-for": {
			parse: (element, aliases) => xbindParser.syntax["x_in_y"](element, "xb-repeat-for", aliases),
			bind: (target, handler) => () => {
				Object.defineProperty(target.obj, target.key, {
					enumerable: !target.key.startsWith("_"),
					configurable: true,
					value: handler,
				})
			},
			unbind: target => {
				Object.defineProperty(target.obj, target.key, {
					get: undefined,
					set: undefined,
				})
				delete target.obj[target.key]
			},
		},
	}

	static bindBlocks(fragment, aliases) {

		function bindVars(aliases) {
			return (element, i) => {
				// parse directive attr
				const dataB = xbindParser.syntax["x"](element, "xb-bind-on", aliases)
				const binder = xbind.binders.find(binder => binder.is(element))
				const normalizerName = $$(element).attr("xb-normalized-by") || dataB.target.key
				const normalizer = val => {
					const normalizers = globalThis.xbindConfig.normalizers
					return normalizers[normalizerName] ? normalizers[normalizerName](val) : val
				}

				// register getter/setter
				Object.defineProperty(dataB.target.obj, dataB.target.key, {
					enumerable: !dataB.target.key.startsWith("_"),
					configurable: true,
					...binder.binder(element, normalizer),
				})

				// register ondestroy handler
				$$(element).on("xb-destroy", evt => {
					Object.defineProperty(dataB.target.obj, dataB.target.key, {
						get: undefined,
						set: undefined,
					})
					delete dataB.target.obj[dataB.target.key]
				})

				// register onchange handler for input element
				$$(element).on("change", () => {
					dataB.target.obj[dataB.target.key] = normalizer(dataB.target.obj[dataB.target.key])
				})
			}
		}

		function parseBlocks(aliases) {
			return (element, i) => {
				// parse directive attr
				const dataI = xbind.cloners["xb-present-if"].parse(element, aliases)
				const dataR = xbind.cloners["xb-repeat-for"].parse(element, aliases)

				function _rename(element, attrName, what) {
					const id = $$(element).attr(attrName)
					const [ boundVars, ] = Object.values(what.alias)
					$$(element).attr(attrName, `${id}-${boundVars.$suffix}`)
				}

				function _clone(what) {
					const aliasesNext = what ? Object.assign({}, aliases, what.alias) : aliases
					const clone = xbind.bindBlocks(element.content.cloneNode(true), aliasesNext)
					what && $$("[id]", clone).each((element, i) => _rename(element, "id", what))
					what && $$("[xb-add-suffix-to]", clone).each((element, i) => {
						const attrNames = $$(element).attr("xb-add-suffix-to").split(",")
						attrNames.forEach(attrName => _rename(element, attrName.trim(), what))
					})
					const addedElements = $$(clone).children()
					return [ clone, addedElements, ]
				}

				function _insert(where, clone, addedElements) {
					const insertTo = where ? [...Array(where.len - where.idx)].reduce(to => $$(to).prev(), element) : element
					$$(clone).insertBefore(insertTo)
					if (where) {
						const addedElementsList = $$(element).data("xb-added-elements") || []
						addedElementsList.splice(where.idx, 0, addedElements)
						$$(element).data("xb-added-elements", addedElementsList)
					} else {
						$$(element).data("xb-added-elements", addedElements)
					}
				}

				function _remove(where) {
					if (where) {
						const addedElementsList = $$(element).data("xb-added-elements") || []
						const [ elementsTobeRemoved, ] = addedElementsList.splice(where.idx, 1)
						$$(element).data("xb-added-elements", addedElementsList)
						return elementsTobeRemoved
					} else {
						const addedElements = $$(element).data("xb-added-elements")
						$$(element).data("xb-added-elements", undefined)
						return addedElements
					}
				}

				$$(element).on("xb-construct", (evt, [ what, where, ]) => {
					const [ clone, addedElements, ] = _clone(what)
					_insert(where, clone, addedElements)
				})

				$$(element).on("xb-destruct", (evt, [ where, ]) => {
					const elementsToBeRemoved = _remove(where)
					if (elementsToBeRemoved) {
						elementsToBeRemoved.each(element => {
							$$("template", element).trigger("xb-destroy")
						})
						$$(elementsToBeRemoved).trigger("xb-destroy")
						$$(elementsToBeRemoved).remove()
					}
				})

				$$(element).on("xb-destroy", evt => {
					const elementsToBeRemoved = $$(element).data("xb-added-elements")
					if (elementsToBeRemoved) {
						elementsToBeRemoved.each(element => {
							$$("template", element).trigger("xb-destroy")
						})
						$$(elementsToBeRemoved).trigger("xb-destroy")
						$$(elementsToBeRemoved).remove()
					}
				})

				if (dataI) {
					$$(element).on("xb-destroy", evt => {
						xbind.cloners["xb-present-if"].unbind(dataI.target)
					})

					const onconstruct = () => $$(element).trigger("xb-construct", [])
					const ondestruct = () => $$(element).trigger("xb-destruct", [])
					const toggler = new xbindToggler(
						dataI.inversion ? ondestruct : onconstruct,
						dataI.inversion ? onconstruct : ondestruct,
					)

					// register handler for adding/removing element
					const binder = xbind.cloners["xb-present-if"].bind(dataI.target, toggler)
					binder()
				} else {
					$$(element).on("xb-destroy", evt => {
						xbind.cloners["xb-repeat-for"].unbind(dataR.target)
					})

					const onconstruct = (boundVars, where) => $$(element).trigger("xb-construct", [ { alias: { [dataR.iterator]: boundVars, }, }, where, ])
					const ondestruct = where => $$(element).trigger("xb-destruct", [ where, ])
					const container = new xbindContainer(onconstruct, ondestruct)

					// register handler for adding/removing element
					const binder = xbind.cloners["xb-repeat-for"].bind(dataR.target, container)
					binder()
				}
			}
		}

		const directives = Object.keys(xbind.cloners).map(str => `[${str}]`).join(",")
		$$("[xb-bind-on]", fragment).each(bindVars(aliases))
		$$(directives, fragment).each(parseBlocks(aliases))
		return fragment
	}

	static bind(boundVars) {
		xbind.bindBlocks(document, { undefined: boundVars, })
	}

	static build(params) {
		const xb = globalThis.xbindConfig || {
			boundVars: {},
			normalizers: params?.normalizers || {},
		}
		globalThis.xbindConfig = xb
		xbind.bind(xb.boundVars)
		return xb.boundVars
	}
}

globalThis.xbind = xbind
