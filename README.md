# Development log

## 2016-10-06
Start creating [jasonycw.github.io](https://jasonycw.github.io/).

### Choosing which CSS to use
Don't want to use CSS for layout but rather uses LESS or SCSS for simplier syntax.

Don't want to make things too complicate, so decide not to use any library that need to compile and hope I don't need to do server setup.

Seems like SCSS cannot be used in client side easily, look like I need to stick with [client side LESS](http://lesscss.org/#client-side-usage)

### Force to make localhost :(
LESS.js cannot be used simply with file system when using Chrome as there are cross domain issue. So testing LESS.js need to create localhost, this makes me a bit annoyed...

Good to know [Node.js](https://nodejs.org/) have a modal called "[http-server](https://www.npmjs.com/package/http-server)" for making localhost pretty painlessly. Open Node.js console, type "`npm install http-server`", and then just "`http-server [repoFolderPath]`". 

Yeay, I got my `localhost:8080` and LESS.js working with my main.less now~

### Flex centering
Trying to center the content. Spent some time to make body tag fill full height, and need to use `min-height: 100vh` instead of `min-height: 100%`

Don't always trust auto complete, typo of `align-items` and `align-content` make me debug for no reason for 30 minutes....

## 2016-10-07
Squeeze some time to try making something interesting, making words with CSS only

### LESS import files
It seems that using browser's less.js cannot render the CSS properly by just put multiple line of `<link rel="stylesheet/less" href="./blablabla.less" />` in the .html file. It needs to use `@import 'blablabl.less` in the .less file. The  weired thing is that I am not sure why some import structure works now.

Right now, main.less import variable.lsee and global.less while global.less import function.less. But the weired thing is that main.less uses function.less functions and global.less use both variables.less and function.less.... 

If I only import global.less in main.less and import varialbes.less and function.less in global.less, it will have compilation error from global.less...

Why the import works now? (Scratching my head)

### Making CSS words
After trying using `:before` and `:after` for making difference icons during work, I always want to try making characters with it. 

![All CSS](/Screenshots/oldExamples.png "No image has been used")

Saw some articles back then when Google changed their logo which can be render with CSS made me interested in the idea. Lets start having some CSS fun :)

![1 try](/Screenshots/1.png)
