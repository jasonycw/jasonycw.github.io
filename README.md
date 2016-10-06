# Development log

## 2016-10-06
Start creating [jasonycw.github.io](jasonycw.github.io).

Don't want to use CSS for layout but rather uses LESS or SCSS for simplier syntax.

Don't want to make things too complicate, so decide not to use any library that need to compile and hope I don't need to do server setup.

Seems like SCSS cannot be used in client side easily, look like I need to stick with [client side LESS](http://lesscss.org/#client-side-usage)

LESS.js cannot be used simply with file system when using Chrome as there are cross domain issue. So testing LESS.js need to create localhost, this makes me a bit annoyed...

Good to know [Node.js](https://nodejs.org/) have a modal called "[http-server](https://www.npmjs.com/package/http-server)" for making localhost pretty painlessly. Open Node.js console, type "`npm install http-server`", and then just "`http-server [repoFolderPath]`". 

Yeay, I got my `localhost:8080` and LESS.js working with my main.less now~
