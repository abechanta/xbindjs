"use strict"

const xbindUtils = require("./utils")

class xbindContainer {

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
		xbindUtils.assignObj(content, obj)
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

module.exports = xbindContainer
