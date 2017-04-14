const gulp = require('gulp')
const $ = require('gulp-load-plugins')()

// image lossy compression plugins
const compressJpg = require('imagemin-jpeg-recompress')
const pngquant = require('imagemin-pngquant-gfw')

const contentSrc = 'src/images'
const contentDst = 'static/images'
const pngFilter = $.filter(['**/*.png'], {restore: true})
const nonAmpFilter = $.filter(['**', '!**/iframe/*.html'], {restore: true})
const gulpAmpValidator = require('gulp-amphtml-validator')

function buildOutputs (sizes, resolutions) {
  var outputs = []
  for (let i = 0; i < sizes.length; i += 1) {
    let size = sizes[i]
    for (let j = 0; j < resolutions.length; j += 1) {
      let res = resolutions[j]
      let resext = '-' + res + 'x'
      if (res === 1) { resext = '' }
      let output = {
        width: size * res,
        rename: {
          suffix: '-' + size + 'px' + resext
        }
      }
      outputs.push(output)
      let webp = JSON.parse(JSON.stringify(output))
      webp.rename.extname = '.webp'
      outputs.push(webp)
    }
  }
  let squares = [150, 300]
  for (let i = 0; i < squares.length; i += 1) {
    let size = squares[i]
    let output = {
      width: size,
      height: size,
      crop: 'entropy',
      rename: {
        suffix: '-square-' + size + 'px'
      }
    }
    outputs.push(output)
    let webp = JSON.parse(JSON.stringify(output))
    webp.rename.extname = '.webp'
    outputs.push(webp)
  }
  outputs.push({
    progressive: true,
    compressionLevel: 6,
    withMetadata: false
  })
  outputs.push({
    rename: {
      extname: '.webp'
    }
  })
  return outputs
}

gulp.task('img-content', function () {
  return gulp.src(contentSrc + '/**/*.{jpg,png}')
    .pipe($.changed(contentDst))
    .pipe($.responsive({
      '**/*': buildOutputs([150, 360, 720, 1280, 1920, 3840], [1])
    }, {
      progressive: true,
      compressionLevel: 6,
      withMetadata: false,
      withoutenlargement: true,
      skipOnEnlargement: true,
      errorOnEnlargement: false,
      errorOnUnusedConfig: false
    }))
    .pipe($.imagemin([
      $.imagemin.gifsicle(),
      compressJpg({
        loops: 4,
        min: 50,
        max: 95,
        quality: 'high'
      }),
      $.imagemin.optipng(),
      $.imagemin.svgo()
    ]))
    .pipe(pngFilter)
    .pipe(pngquant({ quality: '65-80', speed: 4 })())
    .pipe(pngFilter.restore)
    .pipe(gulp.dest(contentDst))
})

gulp.task('images', ['img-content'])
gulp.task('img-content:clean', function () {
  return gulp.src(contentDst, {read: false})
    .pipe($.clean())
})
gulp.task('images:clean', ['img-content:clean'])

gulp.task('amphtml:validate', () => {
  return gulp.src('public/**/*.html')
    .pipe(nonAmpFilter)
    .pipe(gulpAmpValidator.validate())
    .pipe(gulpAmpValidator.format())
    .pipe(nonAmpFilter.restore)
    .pipe(gulpAmpValidator.failAfterError())
})
