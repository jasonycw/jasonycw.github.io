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

## 2018-03-08
Was trying to include some node.js in this repo for future reference.
Then came across gulp and then Webpack which is .... very non-beginner friendly...

### Webpack
Googled some bacis info on Webpack. Read [Ahsan Ayaz's article](https://medium.com/@ahsan.ayaz/beginners-guide-to-webpack-how-to-start-a-basic-application-with-webpack-2-ebed3172fa8c) and [Andre Ray's article](https://blog.andrewray.me/webpack-when-to-use-and-why/) to get some basic idea.

Stucked at installing npm packages for quite some time. Wanted to follow the article to make some basic hello world program, but the commands weren't working. 
Spent a lot of time to figure out why webpack-dev-server not working, turns out webpack-cli is not installed correctly due to some [fork issue recently on their git](https://github.com/webpack/webpack-cli/issues/182). But somehow it started pulling correctly after a few try, maybe my timing was just right.

### Less loader
Then tried to add the [`less-loader`](https://github.com/webpack-contrib/less-loader) to do the LESS to CSS convertion. But wasn't able to make the [`extract-text-webpack-plugin`](https://github.com/webpack-contrib/extract-text-webpack-plugin) working. Found out latest Webpack is not supporting the current version of Extract Text Plugin... need to [`npm install extract-webpack-plugin@next`](https://github.com/webpack/webpack/issues/6568) and use the beta version...

After making Extract Text Plugin working, have no clue why the .less files are still not converted. Turn out Webpack only do what is included from the entry .js file. So adding `require('your.less');` will make it compile and create .css in the dist folder.
And no need to require all .less files, less-loader will also handle `@import 'parent.less';`.

### Boilerplate
Even making the server working, codes are a pile of mess. Files are everywhere. So read a few boilerplate on github and try to copy others' folder structure. [This](https://github.com/seebaermichi/simple-webpack-less-es6-boilerplate) and [this](https://libraries.io/github/davidpelayo/webpack-js-less-boilerplate) seems to be a good start?

Final settled on the following sturcture
```
dist\
   bundle.js
   style.css
src\
   js\
      main.js
   less\
      main.less
index.html
```

### Hot reload
Webpack dev server supports hot reload for .css and .js by watching files' changes. So tried that a bit. But I didn't want to be more overwhelm by even more [loader](https://github.com/AriaFallah/WebpackTutorial/tree/master/part1/html-reload), I just use VSCode to create 2 terminals. 

One running `webpack-dev-server`, one running `webpack`. 

So `webpack-dev-server` will do hot reload of the page and `webpack` will help update the `dist` folder that allow index.html to load the files properly.


Final result is that `http://localhost:8080/` will response to the .less and .js changes from editor and only need to F5 the page when update the .html file.


Well, not doing front end for a year makes everything feels miles away.
So many terms, libraries need to be learn to just get started. :\
