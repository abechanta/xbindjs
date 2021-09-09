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
			get: () => this.$contents[idx].boundVars,
			set: val => this.$contents[idx].boundVars = val,
		})
	}

	_deleteAccessor() {
		const idx = this.$contents.length
		Object.defineProperty(this, idx, {
			enumerable: true,
			configurable: true,
			get: undefined,
			set: undefined,
		})
		delete this[idx]
	}

	_createContent(obj, idx, len) {
		this._createAccessor()
		const content = { boundVars: {}, elements: [], }
		const addedElements = this._oncreate(content.boundVars, idx, len)
		content.elements.push(...addedElements)
		xbind._assignObj(content.boundVars, obj)
		return content
	}

	_deleteContent(content) {
		this._deleteAccessor()
		this._ondelete(content.elements)
		return content.boundVars
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
			deletedContents.push(this._deleteContent(content))
		}
		for (let obj of objs.reverse()) {
			const content = this._createContent(obj, start, this.$contents.length)
			this.$contents.splice(start, 0, content)
		}
		return deletedContents
	}

	pop() {
		const content = this.$contents.pop()
		return this._deleteContent(content)
	}

	shift() {
		const content = this.$contents.shift()
		return this._deleteContent(content)
	}

	every() {
		return this.$contents.map(content => content.boundVars).every(...arguments)
	}

	filter() {
		return this.$contents.map(content => content.boundVars).filter(...arguments)
	}

	find() {
		return this.$contents.map(content => content.boundVars).find(...arguments)
	}

	findIndex() {
		return this.$contents.map(content => content.boundVars).findIndex(...arguments)
	}

	forEach() {
		return this.$contents.map(content => content.boundVars).forEach(...arguments)
	}

	includes() {
		return this.$contents.map(content => content.boundVars).includes(...arguments)
	}

	keys() {
		return this.$contents.map(content => content.boundVars).keys(...arguments)
	}

	map() {
		return this.$contents.map(content => content.boundVars).map(...arguments)
	}

	reduce() {
		return this.$contents.map(content => content.boundVars).reduce(...arguments)
	}

	reduceRight() {
		return this.$contents.map(content => content.boundVars).reduceRight(...arguments)
	}

	reverse() {
		return this.$contents.map(content => content.boundVars).reverse(...arguments)
	}

	some() {
		return this.$contents.map(content => content.boundVars).some(...arguments)
	}

	sort() {
		return this.$contents.map(content => content.boundVars).sort(...arguments)
	}

	values() {
		return this.$contents.map(content => content.boundVars).values(...arguments)
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
			setter: (obj, key, oncreate, ondelete) => () => {
				obj[key] = new xbindArray(oncreate, ondelete)
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
				const onCreateI = () => {
					const clone = cloneBlock(element.content.cloneNode(true), aliases, {})
					const addedElements = $(clone).children()
					element.parentNode.insertBefore(clone, element)
					return addedElements
				}
				const onCreateR = (boundVars, idx, len) => {
					const clone = cloneBlock(element.content.cloneNode(true), aliases, { [dataR.iterator]: boundVars, })
					const addedElements = $(clone).children()
					const insertTo = [...Array(len - idx)].reduce(to => $(to).prev(), element)
					$(insertTo).before(clone)
					return addedElements
				}
				const onDelete = elements => {
					$(elements).remove()
				}

				if (dataI) {
					const task = dataR ? xbind.cloners["xb-repeat-for"].setter(dataR.target.obj, daraR.target.key, onCreateR, onDelete) : onCreateI
					const taskWrapper = dataI.inversion ? val => !val && task() : val => val && task()

					// register getter/setter
					const setterWrapper = xbind.cloners["xb-present-if"].setter(dataI.target.obj, dataI.target.key, taskWrapper)
					setterWrapper()
				} else {
					// register oncreate handler for adding element
					const setterWrapper = xbind.cloners["xb-repeat-for"].setter(dataR.target.obj, dataR.target.key, onCreateR, onDelete)
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
