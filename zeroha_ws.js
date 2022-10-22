// npm install ws
var WebSocket = require('ws')
var fs = require("fs")


class n {
  constructor() {
    this.handlers = []
  }
  on(e) {
    this.handlers.push(e)
  }
  off(e) {
    this.handlers = this.handlers.filter(t => t !== e)
  }
  trigger(e) {
    this.handlers.slice(0).forEach(t => t(e))
  }
}

class r {
  constructor(e) {
    this.mSubscribe = "subscribe",
      this.mUnSubscribe = "unsubscribe",
      this.mSetMode = "mode",
      this.mGetQuote = "quote",
      this.mAlert = 10,
      this.mOrderStr = "order",
      this.mMessage = 11,
      this.mMessageStr = "message",
      this.mLogout = 12,
      this.mLogoutStr = "logout",
      this.mReload = 13,
      this.mReloadStr = "reload",
      this.mClearCache = 14,
      this.mClearCacheStr = "clear_cache",
      this.modeLTP = "ltp",
      this.modeLTPC = "ltpc",
      this.modeFull = "full",
      this.modeQuote = "quote",
      this.modeWeights = {
        [this.modeFull]: 1,
        [this.modeQuote]: 2,
        [this.modeLTPC]: 3,
        [this.modeLTP]: 4
      },
      this.weightModeMap = {
        1: this.modeFull,
        2: this.modeQuote,
        3: this.modeLTPC,
        4: this.modeLTP
      },
      this.segmentNseCM = 1,
      this.segmentNseFO = 2,
      this.segmentNseCD = 3,
      this.segmentBseCM = 4,
      this.segmentBseFO = 5,
      this.segmentBseCD = 6,
      this.segmentMcxFO = 7,
      this.segmentMcxSX = 8,
      this.segmentNseIndices = 9,
      this.segmentUS = 11,
      this.eventConnect = new n,
      this.eventTick = new n,
      this.eventData = new n,
      this.eventDisconnect = new n,
      this.eventReconnect = new n,
      this.eventNoReconnect = new n,
      this.eventAlert = new n,
      this.eventMessage = new n,
      this.eventReload = new n,
      this.eventClearCache = new n,
      this.eventLogout = new n,
      this.connectionTimeout = 5,
      this.reconnectInterval = 5,
      this.reconnectTries = 300,
      this.isAutoReconnect = !0,
      this.reconnectionsCount = 0,
      this.currentWsUrl = null,
      this.tokenTags = {},
      this.subscribedTokens = [],
      this.defaultTokenTag = "_",
      this.version = "1.0.0",
      this.userAgent = "kite3-web",
      this.quoteMap = {},
      this.getQuoteTimeout = 5,
      this.address = e.address,
      this.apiKey = e.apiKey,
      this.publicToken = e.publicToken,
      this.userId = e.userId,
      e.version && (this.version = e.version),
      this.debug = e.debug
  }
  initParams(e) {
    this.address = e.address,
      this.apiKey = e.apiKey,
      this.publicToken = e.publicToken,
      this.userId = e.userId,
      e.version && (this.version = e.version),
      this.debug = e.debug
  }
  isConnected() {
    return !(!this.ws || this.ws.readyState !== this.ws.OPEN)
  }
  setAutoReconnect(e, t) {
    this.isAutoReconnect = e,
      this.reconnectTries = t
  }
  getsubscribedTokens() {
    return this.subscribedTokens
  }
  connect(e) {
    var t = this;
    (!this.ws || this.ws.readyState !== this.ws.CONNECTING && this.ws.readyState !== this.ws.OPEN) && (this.ws = new WebSocket(this.address + "?api_key=" + this.apiKey + "&user_id=" + this.userId + "&public_token=" + this.publicToken + "&uid=" + (new Date).getTime().toString() + "&user-agent=" + this.userAgent + "&version=" + this.version),
      this.ws.binaryType = "arraybuffer",
      this.ws.onopen = function (e) {
        t.resubscribe(),
          t.eventConnect.trigger(),
          t.setConnectionTimer()
      }
      ,
      this.ws.onmessage = function (e) {
        if (t.eventData.trigger(e.data),
          e.data instanceof ArrayBuffer) {
          if (e.data.byteLength > 2) {
            var s = t.parseBinary(e.data);
            s && t.eventTick.trigger(s)
          }
        } else
          t.processMessage(e.data);
        t.lastDataReceivedTime = new Date
      }
      ,
      this.ws.onerror = function (e) {
        t.ws && t.ws.readyState === t.ws.OPEN && this.close()
      }
      ,
      this.ws.onclose = function (e) {
        t.currentWsUrl && this.url !== t.currentWsUrl || t.triggerDisconnect()
      }
    )
  }
  subscribe(e, t) {
    t = this.getTag(t);
    let s = [];
    for (let i of e)
      "number" === typeof i && (this.isElementInArray(this.subscribedTokens, i) || (s.push(i),
        this.tokenTags[i] = {
          mode: "",
          tags: {}
        },
        this.subscribedTokens.push(i)));
    return s.length > 0 && this.send({
      a: this.mSubscribe,
      v: s
    }),
      s
  }
  unsubscribe(e, t) {
    t = this.getTag(t);
    let s = [];
    for (let i of e)
      "number" === typeof i && (this.deleteTokenTags(i, t),
        this.canUnsubscribe(i, t) && (s.push(i),
          this.deleteSubscriptionToken(i),
          delete this.tokenTags[i]));
    return s.length > 0 && this.send({
      a: this.mUnSubscribe,
      v: s
    }),
      s
  }
  setMode(e, t, s) {
    s = this.getTag(s);
    let i = {};
    for (let n of t) {
      if (!this.isElementInArray(this.subscribedTokens, n)) {
        this.deleteTokenTags(n, s);
        continue
      }
      if (e === this.tokenTags[n].mode)
        continue;
      if ("number" !== typeof n)
        continue;
      this.updateTokenTags(n, e, s);
      let t = this.getBestMode(n, e, s);
      t && t !== this.tokenTags[n].mode && (i[t] || (i[t] = []),
        i[t].push(n)),
        this.tokenTags[n].mode = t
    }
    for (let n of Object.keys(i))
      this.send({
        a: this.mSetMode,
        v: [n, i[n]]
      })
  }
  resubscribe() {
    if (0 === this.subscribedTokens.length)
      return;
    let e = {};
    for (let s of this.subscribedTokens)
      "number" === typeof s && this.tokenTags[s] && this.tokenTags[s].mode && (e[this.tokenTags[s].mode] || (e[this.tokenTags[s].mode] = []),
        e[this.tokenTags[s].mode].push(s));
    for (var t of (this.send({
      a: this.mSubscribe,
      v: this.subscribedTokens
    }),
      Object.keys(e)))
      this.send({
        a: this.mSetMode,
        v: [t, e[t]]
      })
  }
  getQuote(e, t, s, n) {
    return this.quoteMap[e] = new i,
      n || (n = this.getQuoteTimeout),
      setTimeout(() => {
        let t = this.quoteMap[e];
        t && (t.reject(),
          delete this.quoteMap[e])
      }
        , 1e3 * n),
      this.send({
        id: e,
        a: this.mGetQuote,
        v: {
          fields: s,
          tokens: t
        }
      }),
      this.quoteMap[e].promise
  }
  isElementInArray(e, t) {
    let s = e.filter(e => e === t);
    return s.length > 0
  }
  deleteSubscriptionToken(e) {
    let t = this.subscribedTokens.indexOf(e);
    t > -1 && this.subscribedTokens.splice(t, 1)
  }
  getTag(e) {
    return e && "string" === typeof e ? e : this.defaultTokenTag
  }
  updateTokenTags(e, t, s) {
    s !== this.defaultTokenTag && (this.tokenTags[e] || (this.tokenTags[e] = {
      mode: t,
      tags: {}
    }),
      this.tokenTags[e]["tags"][s] = this.modeWeights[t])
  }
  deleteTokenTags(e, t) {
    this.tokenTags[e] && this.tokenTags[e].tags && this.tokenTags[e].tags[t] && delete this.tokenTags[e].tags[t]
  }
  getBestMode(e, t, s) {
    if (s === this.defaultTokenTag)
      return t;
    let i = Math.min.apply(Math, Object.keys(this.tokenTags[e].tags).map(t => this.tokenTags[e].tags[t]));
    return i ? this.weightModeMap[i] : t
  }
  canUnsubscribe(e, t) {
    if (!this.isElementInArray(this.subscribedTokens, e))
      return !1;
    if (t === this.defaultTokenTag)
      return !0;
    if (!this.tokenTags[e])
      return !0;
    let s = Object.keys(this.tokenTags[e].tags).filter(e => e !== t);
    return !(s.length > 0)
  }
  triggerDisconnect() {
    this.eventDisconnect.trigger(),
      this.isAutoReconnect ? this.attemptReconnection() : this.eventNoReconnect.trigger()
  }
  setConnectionTimer() {
    clearInterval(this.connectionTimer),
      this.lastDataReceivedTime = new Date,
      this.connectionTimer = setInterval(() => {
        ((new Date).getTime() - this.lastDataReceivedTime.getTime()) / 1e3 >= this.connectionTimeout && (this.currentWsUrl = null,
          this.ws && this.ws.close(),
          clearInterval(this.connectionTimer),
          this.triggerDisconnect())
      }
        , 1e3 * this.connectionTimeout)
  }
  attemptReconnection() {
    this.reconnectionsCount > this.reconnectTries ? this.eventNoReconnect.trigger() : (this.eventReconnect.trigger(this.reconnectInterval),
      setTimeout(() => {
        this.connect(!0)
      }
        , 1e3 * this.reconnectInterval),
      this.reconnectionsCount++)
  }
  send(e) {
    if (this.ws && this.ws.readyState === this.ws.OPEN)
      try {
        this.ws.send(JSON.stringify(e))
      } catch (t) {
        this.ws.close()
      }
  }
  dateToString(e) {
    let t = e.getFullYear().toString()
      , s = (e.getMonth() + 1).toString()
      , i = e.getDate().toString()
      , n = e.getMinutes().toString()
      , r = e.getHours().toString()
      , a = e.getSeconds().toString();
    s.length < 2 && (s = "0" + s),
      i.length < 2 && (i = "0" + i),
      r.length < 2 && (r = "0" + r),
      n.length < 2 && (n = "0" + n),
      a.length < 2 && (a = "0" + a);
    let o = `${t}-${s}-${i} ${r}:${n}:${a}`;
    return o
  }
  parseBinary(e) {
    let t = this.splitPackets(e)
      , s = [];
    for (let i of t) {
      let e, t = this.buf2long(i.slice(0, 4)), n = 255 & t, r = 100;
      switch (n === this.segmentNseCD && (r = 1e7),
      n === this.segmentBseCD && (r = 1e4),
      n) {
        case this.segmentMcxFO:
        case this.segmentNseCM:
        case this.segmentBseCM:
        case this.segmentNseFO:
        case this.segmentNseCD:
        case this.segmentBseCD:
        case this.segmentNseIndices:
        case this.segmentUS:
          if (8 === i.byteLength)
            s.push({
              mode: this.modeLTP,
              isTradeable: !0,
              token: t,
              lastPrice: this.buf2long(i.slice(4, 8)) / r
            });
          else if (12 === i.byteLength) {
            if (e = {
              mode: this.modeLTPC,
              isTradeable: !0,
              token: t,
              lastPrice: this.buf2long(i.slice(4, 8)) / r,
              closePrice: this.buf2long(i.slice(8, 12)) / r
            },
              e.change = 0,
              e.absoluteChange = 0,
              0 !== e.closePrice) {
              let t = e.lastPrice - e.closePrice;
              e.change = 100 * t / e.closePrice,
                e.absoluteChange = t
            }
            s.push(e)
          } else if (28 === i.byteLength || 32 === i.byteLength) {
            if (e = {
              mode: this.modeFull,
              isTradeable: !1,
              token: t,
              lastPrice: this.buf2long(i.slice(4, 8)) / r,
              highPrice: this.buf2long(i.slice(8, 12)) / r,
              lowPrice: this.buf2long(i.slice(12, 16)) / r,
              openPrice: this.buf2long(i.slice(16, 20)) / r,
              closePrice: this.buf2long(i.slice(20, 24)) / r
            },
              e.change = 0,
              e.absoluteChange = 0,
              0 !== e.closePrice) {
              let t = e.lastPrice - e.closePrice;
              e.change = 100 * t / e.closePrice,
                e.absoluteChange = t
            }
            s.push(e)
          } else if (492 === i.byteLength) {
            let e = {
              mode: this.modeFull,
              token: t,
              extendedDepth: {
                buy: [],
                sell: []
              }
            }
              , n = 0
              , a = i.slice(12, 492);
            for (let t = 0; t < 40; t++)
              n = 12 * t,
                e.extendedDepth[t < 20 ? "buy" : "sell"].push({
                  quantity: this.buf2long(a.slice(n, n + 4)),
                  price: this.buf2long(a.slice(n + 4, n + 8)) / r,
                  orders: this.buf2long(a.slice(n + 8, n + 12))
                });
            s.push(e)
          } else {
            if (e = {
              mode: this.modeQuote,
              token: t,
              isTradeable: !0,
              volume: this.buf2long(i.slice(16, 20)),
              lastQuantity: this.buf2long(i.slice(8, 12)),
              totalBuyQuantity: this.buf2long(i.slice(20, 24)),
              totalSellQuantity: this.buf2long(i.slice(24, 28)),
              lastPrice: this.buf2long(i.slice(4, 8)) / r,
              averagePrice: this.buf2long(i.slice(12, 16)) / r,
              openPrice: this.buf2long(i.slice(28, 32)) / r,
              highPrice: this.buf2long(i.slice(32, 36)) / r,
              lowPrice: this.buf2long(i.slice(36, 40)) / r,
              closePrice: this.buf2long(i.slice(40, 44)) / r
            },
              e.change = 0,
              e.absoluteChange = 0,
              0 !== e.closePrice) {
              let t = e.lastPrice - e.closePrice;
              e.change = 100 * t / e.closePrice,
                e.absoluteChange = t
            }
            if (164 === i.byteLength || 184 === i.byteLength) {
              let t = 44;
              184 === i.byteLength && (t = 64);
              let s = t + 120;
              if (e.mode = this.modeFull,
                e.depth = {
                  buy: [],
                  sell: []
                },
                184 === i.byteLength) {
                let t = this.buf2long(i.slice(44, 48));
                e.lastTradedTime = t && t > 0 ? this.dateToString(new Date(1e3 * t)) : null,
                  e.oi = this.buf2long(i.slice(48, 52)),
                  e.oiDayHigh = this.buf2long(i.slice(52, 56)),
                  e.oiDayLow = this.buf2long(i.slice(56, 60))
              }
              let n = 0
                , a = i.slice(t, s);
              for (let i = 0; i < 10; i++)
                n = 12 * i,
                  e.depth[i < 5 ? "buy" : "sell"].push({
                    price: this.buf2long(a.slice(n + 4, n + 8)) / r,
                    orders: this.buf2long(a.slice(n + 8, n + 10)),
                    quantity: this.buf2long(a.slice(n, n + 4))
                  })
            }
            s.push(e)
          }
      }
    }
    console.log(s.length);
    fs.writeFile('quote.txt', JSON.stringify(s), function (err) {
      if (err) {
        return console.error(err);
      };
      if (s.length > 0){
        process.exit();
      }
    });
    return s
  }
  splitPackets(e) {
    let t = this.buf2long(e.slice(0, 2))
      , s = 2
      , i = [];
    for (let a = 0; a < t; a++) {
      var n = this.buf2long(e.slice(s, s + 2))
        , r = e.slice(s + 2, s + 2 + n);
      i.push(r),
        s += 2 + n
    }
    return i
  }
  processMessage(e) {
    try {
      var t = JSON.parse(e)
    } catch (n) {
      return
    }
    if (!t.hasOwnProperty("t") && !t.hasOwnProperty("type"))
      return;
    let s = t.t || t.type
      , i = t.p || t.data;
    switch (s) {
      case this.mAlert:
      case this.mOrderStr:
        this.eventAlert.trigger(t);
        break;
      case this.mMessage:
      case this.mMessageStr:
        this.eventMessage.trigger(i);
        break;
      case this.mLogout:
      case this.mLogoutStr:
        this.eventLogout.trigger();
        break;
      case this.mReload:
      case this.mReloadStr:
        this.eventReload.trigger();
        break;
      case this.mClearCache:
      case this.mClearCacheStr:
        if (i)
          try {
            let e = JSON.parse(i);
            this.eventClearCache.trigger(e)
          } catch (n) { }
        else
          this.eventClearCache.trigger();
        break;
      case this.mGetQuote:
        this.processQuoteMessage(t.id, i);
        break
    }
  }
  processQuoteMessage(e, t) {
    let s = this.quoteMap[e];
    s && (s.resolve(t),
      delete this.quoteMap[e])
  }
  buf2long(e) {
    let t = new Uint8Array(e)
      , s = 0
      , i = t.length;
    for (let n = 0, r = i - 1; n < i; n++ ,
      r--)
      s += t[r] << 8 * n;
    return s
  }
}

// console.dir(typeof r);
// console.dir(r);
var e = {
  "address": "wss://ws.zerodha.com",
  "apiKey": "kitefront",
  "publicToken": "XA8iFexSaFBGL1q3CUL7mOIoDIcGliPn",
  "userId": "WO6148",
  "version": "2.4.0",
  "debug": true
}
var r_ = new r(e)
// console.dir(r_);
r_.connect();

var data = fs.readFileSync('marketwatch.min.csv');
var tokens = [];
for (let line of data.toString().trim().split('\r\n').slice(1)) {
  x = line.split(',');
  tokens.push(Number(x[1]));
}
// console.log(tokens.slice(0, 5));
r_.subscribe(tokens);