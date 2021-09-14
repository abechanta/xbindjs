# xbind.js - super simple, lightweight & friendly

**xbind.js** is a rugged, minimal frontend helper for manipulating contents on your web page.

## No virtual DOM, non reactive..., this is good old style but reasonable

Include a single script, markup your page, and ready for working with your frontend scripts. The variables returned from **xbind.js** can be used as *view-model*. Think of it like jQuery for the modern web. It’s super simple that you can get started **xbind.js** within few minutes.

## Binding

```html
<html>
	<head>
		<script src="https://unpkg.com/xbindjs"></script>
	</head>
	<body>
		<h1 xb-bind-on="head.message1"></h1>
		<div xb-bind-on="head.message2"></div>

		<script>
			const boundVars = window.xbind.build()
			boundVars.head.message1 = "Hello, xbind.js!"
			boundVars.head.message2 = "You can easily modify elements on your page."
		</script>
	</body>
</html>
```

This code tells you what **xbind.js** will bring to you. With a `xb-bind-on` keyword, you can modify inner texts of DOM elements by assigning strings to bound variables.

```html
<html>
	<head>
		<script src="https://unpkg.com/xbindjs"></script>
		<script src="https://unpkg.com/jquery"></script>
	</head>
	<body>
		<h1>Your address</h1>
		<form>
			<div>Address 1</div>
			<input type="text" xb-bind-on="addr.address.0" />
			<div>Address 2</div>
			<input type="text" xb-bind-on="addr.address.1" />
			<div>City</div>
			<input type="text" xb-bind-on="addr.city" />
			<div>State</div>
			<input type="text" xb-bind-on="addr.state" />
			<div>Zip</div>
			<input type="text" xb-bind-on="addr.zipcode" />
			<div>Country</div>
			<input type="text" xb-bind-on="addr.country" />
			<div>
				<button type="button" id="submit">Print</button>
			</div>
		</form>

		<script>
			const boundVars = window.xbind.build()
			$("#submit").click(() => console.log(boundVars))
		</script>
	</body>
</html>
```

You can also get values or texts from your input elements as well. These bound variables are bound bi-directionally, so that you can retrieve input values easily.

```html
<html>
	<head>
		<script src="https://unpkg.com/xbindjs"></script>
	</head>
	<body>
		<h1>Your links</h1>
		<ul>
			<li><a xb-bind-on="link.url.0" xb-affect-to="href">First</a></li>
			<li><a xb-bind-on="link.url.1" xb-affect-to="href">Second</a></li>
			<li><a xb-bind-on="link.url.2" xb-affect-to="href">Third</a></li>
		</ul>

		<script>
			const boundVars = window.xbind.build()
			boundVars.link.url[0] = "https://example.com/first"
			boundVars.link.url[1] = "https://example.com/second"
			boundVars.link.url[2] = "https://example.com/third"
		</script>
	</body>
</html>
```

With a `xb-affect-to` keyword, you can modify properties of elements as well.

## Cloning with template

```html
<html>
	<head>
		<script src="https://unpkg.com/xbindjs"></script>
	</head>
	<body>
		<h1>Your section</h1>
		<template xb-present-if="firstTime">
			<div>Welcome to xbind.js!</div>
		</template>
		<template xb-present-if="not firstTime2">
			<div>Welcome back!</div>
		</template>

		<script>
			const boundVars = window.xbind.build()
			boundVars.firstTime = true
		</script>
	</body>
</html>
```

With a `xb-present-if` keyword along with `template` tag, you can add a block of DOM elements from script.

```html
<html>
	<head>
		<script src="https://unpkg.com/xbindjs"></script>
	</head>
	<body>
		<h1>Your table</h1>
		<table>
			<tr>
				<th>Year</th>
				<th>Place</th>
			</tr>
			<template xb-repeat-for="$item in items">
				<tr>
					<td xb-bind-on="$item.year"></td>
					<td xb-bind-on="$item.place"></td>
				</tr>
			</template>
		</table>

		<script>
			const boundVars = window.xbind.build()
			boundVars.items.push(
				{ year: 2016, place: "Rio de Janeiro", },
			)
			boundVars.items.push(
				{ year: 2020, place: "Tokyo", },
				{ year: 2024, place: "Paris", },
			)
			boundVars.items[1].year = 2021
		</script>
	</body>
</html>
```

With a `xb-repeat-for` keyword along with `template` tag, you can duplicate a block of DOM elements as you need.
