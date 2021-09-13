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
		const [ ref0, ] = reference.split(".")
		if (ref0.startsWith("$") && aliases.hasOwnProperty(ref0)) {
			return [ aliases[ref0], reference.replace(`${ref0}.`, ""), ]
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

class xbindArray {

	constructor(oncreate, ondelete) {
		Object.defineProperty(this, "_oncreate", {
			value: oncreate,
		})
		Object.defineProperty(this, "_ondelete", {
			value: ondelete,
		})
		Object.defineProperty(this, "$contents", {
			value: [],
		})
		Object.defineProperty(this, "length", {
			get: () => this.$contents.length,
			set: val => {
				while (this.$contents.length > val) {
					this.pop()
				}
				while (this.$contents.length < val) {
					this.push({})
				}
			},
		})
	}

	_createAccessor() {
		const idx = this.$contents.length
		Object.defineProperty(this, idx, {
			enumerable: true,
			configurable: true,
			get: () => this.$contents[idx],
			set: val => this.$contents[idx] = val,
		})
	}

	_deleteAccessor() {
		const idx = this.$contents.length
		Object.defineProperty(this, idx, {
			get: undefined,
			set: undefined,
		})
		delete this[idx]
	}

	_createContent(obj, idx, len) {
		this._createAccessor()
		const content = {}
		this._oncreate(content, { idx, len, })
		xbind._assignObj(content, obj)
		return content
	}

	_deleteContent(content, idx, len) {
		this._deleteAccessor()
		this._ondelete({ idx, len, })
		return content
	}

	push(...objs) {
		for (let obj of objs) {
			const content = this._createContent(obj, this.$contents.length, this.$contents.length)
			this.$contents.push(content)
		}
		return this.$contents.length
	}

	unshift(...objs) {
		for (let obj of objs.reverse()) {
			const content = this._createContent(obj, 0, this.$contents.length)
			this.$contents.unshift(content)
		}
		return this.$contents.length
	}

	splice(start, deleteCount, ...objs) {
		const deletedContents = []
		for (let i = 0; i < deleteCount; i++) {
			const [ content, ] = this.$contents.splice(start, 1)
			deletedContents.push(this._deleteContent(content, start, this.$contents.length))
		}
		for (let obj of objs.reverse()) {
			const content = this._createContent(obj, start, this.$contents.length)
			this.$contents.splice(start, 0, content)
		}
		return deletedContents
	}

	pop() {
		const content = this.$contents.pop()
		return this._deleteContent(content, this.$contents.length, this.$contents.length)
	}

	shift() {
		const content = this.$contents.shift()
		return this._deleteContent(content, 0, this.$contents.length)
	}

	every() {
		return this.$contents.every(...arguments)
	}

	filter() {
		return this.$contents.filter(...arguments)
	}

	find() {
		return this.$contents.find(...arguments)
	}

	findIndex() {
		return this.$contents.findIndex(...arguments)
	}

	forEach() {
		return this.$contents.forEach(...arguments)
	}

	includes() {
		return this.$contents.includes(...arguments)
	}

	keys() {
		return this.$contents.keys(...arguments)
	}

	map() {
		return this.$contents.map(...arguments)
	}

	reduce() {
		return this.$contents.reduce(...arguments)
	}

	reduceRight() {
		return this.$contents.reduceRight(...arguments)
	}

	reverse() {
		return this.$contents.reverse(...arguments)
	}

	some() {
		return this.$contents.some(...arguments)
	}

	sort() {
		return this.$contents.sort(...arguments)
	}

	values() {
		return this.$contents.values(...arguments)
	}
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

	static bindBlocks(fragment, normalizers, aliases) {

		function bindVars(aliases, normalizers) {
			return (i, element) => {
				// parse directive attr
				const dataB = xbindParser.syntax["x"](element, "xb-bind-on", aliases)
				const binder = xbind.binders.find(binder => binder.is(element))
				const normalizer = normalizers[dataB.target.key] || (val => val)

				// register getter/setter
				Object.defineProperty(dataB.target.obj, dataB.target.key, {
					enumerable: !dataB.target.key.startsWith("_"),
					configurable: true,
					...binder.binder(element, normalizer),
				})

				// register ondestroy handler
				$(element).on("xb-destroy", evt => {
					Object.defineProperty(dataB.target.obj, dataB.target.key, {
						get: undefined,
						set: undefined,
					})
					delete dataB.target.obj[dataB.target.key]
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

				function _clone(what) {
					const aliasesNext = what ? Object.assign({}, aliases, what.alias) : aliases
					const clone = xbind.bindBlocks(element.content.cloneNode(true), normalizers, aliasesNext)
					const addedElements = $(clone).children()
					return [ clone, addedElements, ]
				}

				function _insert(where, clone, addedElements) {
					const insertTo = where ? [...Array(where.len - where.idx)].reduce(to => $(to).prev(), element) : element
					$(insertTo).before(clone)
					if (where) {
						const addedElementsList = $(element).data("xb-added-elements") || []
						addedElementsList.splice(where.idx, 0, addedElements)
						$(element).data("xb-added-elements", addedElementsList)
					} else {
						$(element).data("xb-added-elements", addedElements)
					}
				}

				function _remove(where) {
					if (where) {
						const addedElementsList = $(element).data("xb-added-elements")
						const [ elementsTobeRemoved, ] = addedElementsList.splice(where.idx, 1)
						$(element).data("xb-added-elements", addedElementsList)
						return elementsTobeRemoved
					} else {
						const addedElements = $(element).data("xb-added-elements")
						$(element).data("xb-added-elements", undefined)
						return addedElements
					}
				}

				$(element).on("xb-construct", (evt, what, where) => {
					const [ clone, addedElements, ] = _clone(what)
					_insert(where, clone, addedElements)
				})

				$(element).on("xb-destruct", (evt, where) => {
					const elementsToBeRemoved = _remove(where)
					if (elementsToBeRemoved) {
						$("template", elementsToBeRemoved).trigger("xb-destroy")
						$(elementsToBeRemoved).trigger("xb-destroy").remove()
					}
				})

				$(element).on("xb-destroy", evt => {
					const elementsToBeRemoved = $(element).data("xb-added-elements")
					if (elementsToBeRemoved) {
						$("template", elementsToBeRemoved).trigger("xb-destroy")
						$(elementsToBeRemoved).trigger("xb-destroy").remove()
					}
				})

				if (dataI) {
					$(element).on("xb-destroy", evt => {
						xbind.cloners["xb-present-if"].unbind(dataI.target)
					})

					const onconstruct = () => $(element).trigger("xb-construct", [])
					const ondestruct = () => $(element).trigger("xb-destruct", [])
					const toggler = new xbindToggler(
						dataI.inversion ? ondestruct : onconstruct,
						dataI.inversion ? onconstruct : ondestruct,
					)

					// register handler for adding/removing element
					const binder = xbind.cloners["xb-present-if"].bind(dataI.target, toggler)
					binder()
				} else {
					$(element).on("xb-destroy", evt => {
						xbind.cloners["xb-repeat-for"].unbind(dataR.target)
					})

					const onconstruct = (boundVars, where) => $(element).trigger("xb-construct", [ { alias: { [dataR.iterator]: boundVars, }, }, where, ])
					const ondestruct = where => $(element).trigger("xb-destruct", [ where, ])
					const array = new xbindArray(onconstruct, ondestruct)

					// register handler for adding/removing element
					const binder = xbind.cloners["xb-repeat-for"].bind(dataR.target, array)
					binder()
				}
			}
		}

		const directives = Object.keys(xbind.cloners).map(str => `[${str}]`).join(",")
		$("[xb-bind-on]", fragment).each(bindVars(aliases, normalizers))
		$(directives, fragment).each(parseBlocks(aliases))
		return fragment
	}

	static bind(boundVars, normalizers) {
		xbind.bindBlocks(document, normalizers, { undefined: boundVars, })
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
