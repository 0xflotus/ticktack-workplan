var PullObv = require('pull-obv')
var threadReduce = require('ssb-reduce-stream')
var pull = require('pull-stream')
var Next = require('pull-next')

var nest = require('depnest')

function isObject (o) {
  return 'object' === typeof o
}

exports.gives = nest({
  'state.obs.threads': true,
  'state.obs.channel': true
})

exports.needs = nest({
  'message.sync.unbox': 'first',
  'sbot.pull.log': 'first',
  'feed.pull.channel': 'first'
})

exports.create = function (api) {
  var threadsObs

  function createStateObs (reduce, createStream, opts, initial) {
    var lastTimestamp = opts.last || Date.now()
    var firstTimestamp = opts.first || Date.now()

    function unbox () {
      return pull(
        pull.map(function (data) {
          if(isObject(data.value.content)) return data
          return api.message.sync.unbox(data)
        }),
        pull.filter(Boolean)
      )
    }

    var obs = PullObv(
      reduce,
      pull(
        Next(function () {
          return createStream({reverse: true, limit: 500, lt: lastTimestamp})
        }),
        pull.through(function (data) {
          lastTimestamp = data.timestamp
        }),
        unbox()
      ),
      //value recovered from localStorage
      initial
    )

    //stream live messages. this *should* work.
    //there is no back pressure on new events
    //only a show more on the top (currently)
    pull(
      Next(function () {
        return createStream({limit: 500, gt: firstTimestamp, live: true})
      }),
      pull.drain(function (data) {
        if(data.sync) return
        firstTimestamp = data.timestamp
        obs.set(reduce(threadsObs.value, data))
      })
    )

    return obs
  }


  return nest({
  'state.obs.channel': function (channel) {

      return createStateObs(
        threadReduce,
        function (opts) {
          return opts.reverse ?
          api.feed.pull.channel(channel)(opts):
          pull(api.sbot.pull.log(opts), pull.filter(function (data) {
            if(data.sync) return false
            return data.value.content.channel === channel
          }))
        },
        {}
      )

    // var channelObs = PullObv(
    //   threadReduce,
    //   createChannelStream({reverse: true, limit: 1000})
    // )


  },
  'state.obs.threads': function buildThreadObs() {
      if(threadsObs) return threadsObs

  // DISABLE localStorage cache. mainly disabling this to make debugging the other stuff
  // easier. maybe re-enable this later? also, should this be for every channel too? not sure.

  //    var initial
  //    try { initial = JSON.parse(localStorage.threadsState) }
  //    catch (_) { }

      initial = {}

      threadsObs = createStateObs(threadReduce, api.sbot.pull.log, initial, {})

      threadsObs(function (threadsState) {
        if(threadsState.ended && threadsState.ended !== true)
          console.error('threadObs error:', threadsState.ended)
      })

  //    var timer
  //    //keep localStorage up to date
  //    threadsObs(function (threadsState) {
  //      if(timer) return
  //      timer = setTimeout(function () {
  //        timer = null
  //        threadsState.last = lastTimestamp
  //        console.log('save state')
  //        localStorage.threadsState = JSON.stringify(threadsState)
  //      }, 1000)
  //    })

      return threadsObs
    }
  })
}



