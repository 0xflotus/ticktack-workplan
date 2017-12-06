var pull = require('pull-stream')
const h = require('mutant').h

exports.gives = {
  message: {
    html: {
      title: true,
      summary: true,
      thumbnail: true,
      content: true
    }
  }
}

exports.needs = {
  message: { html: { markdown: 'first' } },
  sbot: { pull: { stream: 'first' } }
}


exports.create = function (api) {

  return {
    message: {
      html: {
        title: function (data) {
          if('blog' == typeof data.value.content.type) return
          return data.value.content.title
        },
        summary: function (data) {
          if('blog' == typeof data.value.content.type) return
          return data.value.content.summary
        },
        thumbnail: function (data) {
          if('blog' == typeof data.value.content.type) return
          return data.value.content.thumbnail
        },
        content: function (data) {
          if('blog' == typeof data.value.content.type) return
          var div = h('Markdown')
          pull(
            api.sbot.pull.stream(function (sbot) {
              return sbot.blobs.get(data.value.content.blog)
            }),
            pull.collect(function (err, ary) {
              if(err) return
              var md = api.message.html.markdown({text:Buffer.concat(ary).toString()})
              div.innerHTML = md.innerHTML
            })
          )
          return div
        }
      }
    }
  }
}

