import { b as e } from "./workflowResults-qoMMSAXH.js";
// Page zoom this script last applied via SET_ZOOM. Debugger clicks (CC) take viewport
// coordinates in DIP while getBoundingClientRect is in CSS px, so they must be scaled.
// DOM-level input (synthetic pointer/mouse/keyboard events + execCommand) was verified on
// Google Vids for every step of the flow, in visible AND hidden tabs. Debugger Input.*
// commands are ignored in hidden tabs and needed zoom-scaled coordinates, so they are now
// only a fallback for text insertion.
const ocDomInput = !0;
let ocZoom = 1,
  ocZoomSettled = Promise.resolve();
// SET_ZOOM is applied asynchronously by the browser; clicks issued before it lands would be
// scaled with the new factor against the old layout. Wait until devicePixelRatio changes.
// Hidden tabs get their timers throttled (down to once per minute), which stretched every
// wait of a background run. While hidden, sleep via the service worker instead.
async function ocSleep(ms, isCancelled) {
  const end = Date.now() + ms;
  for (;;) {
    if (isCancelled && isCancelled()) throw new Error("Cancelled");
    const left = end - Date.now();
    if (left <= 0) return;
    const step = Math.min(left, document.hidden ? 1e3 : 50);
    if (document.hidden)
      try {
        const r = await chrome.runtime.sendMessage({ type: "OC_SLEEP", ms: step });
        if (r?.ok) continue;
      } catch {}
    await new Promise((r) => setTimeout(r, step));
  }
}
function ocTrackZoom(z) {
  const before = window.devicePixelRatio;
  ocZoom = z;
  ocZoomSettled = (async () => {
    const t0 = Date.now();
    for (; window.devicePixelRatio === before && Date.now() - t0 < 1500; )
      await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 150));
  })();
}

function t(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default")
    ? e.default
    : e;
}
var n,
  r,
  o,
  i = { exports: {} };
const s = t(
    n
      ? i.exports
      : ((n = 1),
        (r = "undefined" != typeof window ? window : i.exports),
        (o = function (e, t) {
          var n = [],
            r = Object.getPrototypeOf,
            o = n.slice,
            i = n.flat
              ? function (e) {
                  return n.flat.call(e);
                }
              : function (e) {
                  return n.concat.apply([], e);
                },
            s = n.push,
            a = n.indexOf,
            u = {},
            c = u.toString,
            l = u.hasOwnProperty,
            d = l.toString,
            p = d.call(Object),
            f = {},
            h = function (e) {
              return (
                "function" == typeof e &&
                "number" != typeof e.nodeType &&
                "function" != typeof e.item
              );
            },
            g = function (e) {
              return null != e && e === e.window;
            },
            m = e.document,
            y = { type: !0, src: !0, nonce: !0, noModule: !0 };
          function v(e, t, n) {
            var r,
              o,
              i = (n = n || m).createElement("script");
            if (((i.text = e), t))
              for (r in y)
                (o = t[r] || (t.getAttribute && t.getAttribute(r))) &&
                  i.setAttribute(r, o);
            n.head.appendChild(i).parentNode.removeChild(i);
          }
          function x(e) {
            return null == e
              ? e + ""
              : "object" == typeof e || "function" == typeof e
                ? u[c.call(e)] || "object"
                : typeof e;
          }
          var w = "3.7.1",
            b = /HTML$/i,
            C = function (e, t) {
              return new C.fn.init(e, t);
            };
          function T(e) {
            var t = !!e && "length" in e && e.length,
              n = x(e);
            return (
              !h(e) &&
              !g(e) &&
              ("array" === n ||
                0 === t ||
                ("number" == typeof t && t > 0 && t - 1 in e))
            );
          }
          function E(e, t) {
            return e.nodeName && e.nodeName.toLowerCase() === t.toLowerCase();
          }
          (C.fn = C.prototype =
            {
              jquery: w,
              constructor: C,
              length: 0,
              toArray: function () {
                return o.call(this);
              },
              get: function (e) {
                return null == e
                  ? o.call(this)
                  : e < 0
                    ? this[e + this.length]
                    : this[e];
              },
              pushStack: function (e) {
                var t = C.merge(this.constructor(), e);
                return (t.prevObject = this), t;
              },
              each: function (e) {
                return C.each(this, e);
              },
              map: function (e) {
                return this.pushStack(
                  C.map(this, function (t, n) {
                    return e.call(t, n, t);
                  }),
                );
              },
              slice: function () {
                return this.pushStack(o.apply(this, arguments));
              },
              first: function () {
                return this.eq(0);
              },
              last: function () {
                return this.eq(-1);
              },
              even: function () {
                return this.pushStack(
                  C.grep(this, function (e, t) {
                    return (t + 1) % 2;
                  }),
                );
              },
              odd: function () {
                return this.pushStack(
                  C.grep(this, function (e, t) {
                    return t % 2;
                  }),
                );
              },
              eq: function (e) {
                var t = this.length,
                  n = +e + (e < 0 ? t : 0);
                return this.pushStack(n >= 0 && n < t ? [this[n]] : []);
              },
              end: function () {
                return this.prevObject || this.constructor();
              },
              push: s,
              sort: n.sort,
              splice: n.splice,
            }),
            (C.extend = C.fn.extend =
              function () {
                var e,
                  t,
                  n,
                  r,
                  o,
                  i,
                  s = arguments[0] || {},
                  a = 1,
                  u = arguments.length,
                  c = !1;
                for (
                  "boolean" == typeof s &&
                    ((c = s), (s = arguments[a] || {}), a++),
                    "object" == typeof s || h(s) || (s = {}),
                    a === u && ((s = this), a--);
                  a < u;
                  a++
                )
                  if (null != (e = arguments[a]))
                    for (t in e)
                      (r = e[t]),
                        "__proto__" !== t &&
                          s !== r &&
                          (c &&
                          r &&
                          (C.isPlainObject(r) || (o = Array.isArray(r)))
                            ? ((n = s[t]),
                              (i =
                                o && !Array.isArray(n)
                                  ? []
                                  : o || C.isPlainObject(n)
                                    ? n
                                    : {}),
                              (o = !1),
                              (s[t] = C.extend(c, i, r)))
                            : void 0 !== r && (s[t] = r));
                return s;
              }),
            C.extend({
              expando: "jQuery" + (w + Math.random()).replace(/\D/g, ""),
              isReady: !0,
              error: function (e) {
                throw new Error(e);
              },
              noop: function () {},
              isPlainObject: function (e) {
                var t, n;
                return !(
                  !e ||
                  "[object Object]" !== c.call(e) ||
                  ((t = r(e)) &&
                    ("function" !=
                      typeof (n = l.call(t, "constructor") && t.constructor) ||
                      d.call(n) !== p))
                );
              },
              isEmptyObject: function (e) {
                var t;
                for (t in e) return !1;
                return !0;
              },
              globalEval: function (e, t, n) {
                v(e, { nonce: t && t.nonce }, n);
              },
              each: function (e, t) {
                var n,
                  r = 0;
                if (T(e))
                  for (
                    n = e.length;
                    r < n && !1 !== t.call(e[r], r, e[r]);
                    r++
                  );
                else for (r in e) if (!1 === t.call(e[r], r, e[r])) break;
                return e;
              },
              text: function (e) {
                var t,
                  n = "",
                  r = 0,
                  o = e.nodeType;
                if (!o) for (; (t = e[r++]); ) n += C.text(t);
                return 1 === o || 11 === o
                  ? e.textContent
                  : 9 === o
                    ? e.documentElement.textContent
                    : 3 === o || 4 === o
                      ? e.nodeValue
                      : n;
              },
              makeArray: function (e, t) {
                var n = t || [];
                return (
                  null != e &&
                    (T(Object(e))
                      ? C.merge(n, "string" == typeof e ? [e] : e)
                      : s.call(n, e)),
                  n
                );
              },
              inArray: function (e, t, n) {
                return null == t ? -1 : a.call(t, e, n);
              },
              isXMLDoc: function (e) {
                var t = e && e.namespaceURI,
                  n = e && (e.ownerDocument || e).documentElement;
                return !b.test(t || (n && n.nodeName) || "HTML");
              },
              merge: function (e, t) {
                for (var n = +t.length, r = 0, o = e.length; r < n; r++)
                  e[o++] = t[r];
                return (e.length = o), e;
              },
              grep: function (e, t, n) {
                for (var r = [], o = 0, i = e.length, s = !n; o < i; o++)
                  !t(e[o], o) !== s && r.push(e[o]);
                return r;
              },
              map: function (e, t, n) {
                var r,
                  o,
                  s = 0,
                  a = [];
                if (T(e))
                  for (r = e.length; s < r; s++)
                    null != (o = t(e[s], s, n)) && a.push(o);
                else for (s in e) null != (o = t(e[s], s, n)) && a.push(o);
                return i(a);
              },
              guid: 1,
              support: f,
            }),
            "function" == typeof Symbol &&
              (C.fn[Symbol.iterator] = n[Symbol.iterator]),
            C.each(
              "Boolean Number String Function Array Date RegExp Object Error Symbol".split(
                " ",
              ),
              function (e, t) {
                u["[object " + t + "]"] = t.toLowerCase();
              },
            );
          var S = n.pop,
            k = n.sort,
            I = n.splice,
            A = "[\\x20\\t\\r\\n\\f]",
            D = new RegExp(
              "^" + A + "+|((?:^|[^\\\\])(?:\\\\.)*)" + A + "+$",
              "g",
            );
          C.contains = function (e, t) {
            var n = t && t.parentNode;
            return (
              e === n ||
              !(
                !n ||
                1 !== n.nodeType ||
                !(e.contains
                  ? e.contains(n)
                  : e.compareDocumentPosition &&
                    16 & e.compareDocumentPosition(n))
              )
            );
          };
          var j = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g;
          function N(e, t) {
            return t
              ? "\0" === e
                ? "\ufffd"
                : e.slice(0, -1) +
                  "\\" +
                  e.charCodeAt(e.length - 1).toString(16) +
                  " "
              : "\\" + e;
          }
          C.escapeSelector = function (e) {
            return (e + "").replace(j, N);
          };
          var R = m,
            P = s;
          !(function () {
            var t,
              r,
              i,
              s,
              u,
              c,
              d,
              p,
              h,
              g,
              m = P,
              y = C.expando,
              v = 0,
              x = 0,
              w = ee(),
              b = ee(),
              T = ee(),
              j = ee(),
              N = function (e, t) {
                return e === t && (u = !0), 0;
              },
              $ =
                "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
              _ =
                "(?:\\\\[\\da-fA-F]{1,6}" +
                A +
                "?|\\\\[^\\r\\n\\f]|[\\w-]|[^\0-\\x7f])+",
              M =
                "\\[" +
                A +
                "*(" +
                _ +
                ")(?:" +
                A +
                "*([*^$|!~]?=)" +
                A +
                "*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" +
                _ +
                "))|)" +
                A +
                "*\\]",
              O =
                ":(" +
                _ +
                ")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|" +
                M +
                ")*)|.*)\\)|)",
              L = new RegExp(A + "+", "g"),
              q = new RegExp("^" + A + "*," + A + "*"),
              F = new RegExp("^" + A + "*([>+~]|" + A + ")" + A + "*"),
              H = new RegExp(A + "|>"),
              B = new RegExp(O),
              W = new RegExp("^" + _ + "$"),
              V = {
                ID: new RegExp("^#(" + _ + ")"),
                CLASS: new RegExp("^\\.(" + _ + ")"),
                TAG: new RegExp("^(" + _ + "|[*])"),
                ATTR: new RegExp("^" + M),
                PSEUDO: new RegExp("^" + O),
                CHILD: new RegExp(
                  "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" +
                    A +
                    "*(even|odd|(([+-]|)(\\d*)n|)" +
                    A +
                    "*(?:([+-]|)" +
                    A +
                    "*(\\d+)|))" +
                    A +
                    "*\\)|)",
                  "i",
                ),
                bool: new RegExp("^(?:" + $ + ")$", "i"),
                needsContext: new RegExp(
                  "^" +
                    A +
                    "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
                    A +
                    "*((?:-\\d)?\\d*)" +
                    A +
                    "*\\)|)(?=[^-]|$)",
                  "i",
                ),
              },
              U = /^(?:input|select|textarea|button)$/i,
              z = /^h\d$/i,
              G = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
              X = /[+~]/,
              Q = new RegExp(
                "\\\\[\\da-fA-F]{1,6}" + A + "?|\\\\([^\\r\\n\\f])",
                "g",
              ),
              Y = function (e, t) {
                var n = "0x" + e.slice(1) - 65536;
                return (
                  t ||
                  (n < 0
                    ? String.fromCharCode(n + 65536)
                    : String.fromCharCode(
                        (n >> 10) | 55296,
                        (1023 & n) | 56320,
                      ))
                );
              },
              J = function () {
                ue();
              },
              K = pe(
                function (e) {
                  return !0 === e.disabled && E(e, "fieldset");
                },
                { dir: "parentNode", next: "legend" },
              );
            try {
              m.apply((n = o.call(R.childNodes)), R.childNodes),
                n[R.childNodes.length].nodeType;
            } catch (xe) {
              m = {
                apply: function (e, t) {
                  P.apply(e, o.call(t));
                },
                call: function (e) {
                  P.apply(e, o.call(arguments, 1));
                },
              };
            }
            function Z(e, t, n, r) {
              var o,
                i,
                s,
                a,
                u,
                l,
                d,
                g = t && t.ownerDocument,
                v = t ? t.nodeType : 9;
              if (
                ((n = n || []),
                "string" != typeof e || !e || (1 !== v && 9 !== v && 11 !== v))
              )
                return n;
              if (!r && (ue(t), (t = t || c), p)) {
                if (11 !== v && (u = G.exec(e)))
                  if ((o = u[1])) {
                    if (9 === v) {
                      if (!(s = t.getElementById(o))) return n;
                      if (s.id === o) return m.call(n, s), n;
                    } else if (
                      g &&
                      (s = g.getElementById(o)) &&
                      Z.contains(t, s) &&
                      s.id === o
                    )
                      return m.call(n, s), n;
                  } else {
                    if (u[2]) return m.apply(n, t.getElementsByTagName(e)), n;
                    if ((o = u[3]) && t.getElementsByClassName)
                      return m.apply(n, t.getElementsByClassName(o)), n;
                  }
                if (!(j[e + " "] || (h && h.test(e)))) {
                  if (((d = e), (g = t), 1 === v && (H.test(e) || F.test(e)))) {
                    for (
                      ((g = (X.test(e) && ae(t.parentNode)) || t) == t &&
                        f.scope) ||
                        ((a = t.getAttribute("id"))
                          ? (a = C.escapeSelector(a))
                          : t.setAttribute("id", (a = y))),
                        i = (l = le(e)).length;
                      i--;

                    )
                      l[i] = (a ? "#" + a : ":scope") + " " + de(l[i]);
                    d = l.join(",");
                  }
                  try {
                    return m.apply(n, g.querySelectorAll(d)), n;
                  } catch (x) {
                    j(e, !0);
                  } finally {
                    a === y && t.removeAttribute("id");
                  }
                }
              }
              return ve(e.replace(D, "$1"), t, n, r);
            }
            function ee() {
              var e = [];
              return function t(n, o) {
                return (
                  e.push(n + " ") > r.cacheLength && delete t[e.shift()],
                  (t[n + " "] = o)
                );
              };
            }
            function te(e) {
              return (e[y] = !0), e;
            }
            function ne(e) {
              var t = c.createElement("fieldset");
              try {
                return !!e(t);
              } catch (xe) {
                return !1;
              } finally {
                t.parentNode && t.parentNode.removeChild(t), (t = null);
              }
            }
            function re(e) {
              return function (t) {
                return E(t, "input") && t.type === e;
              };
            }
            function oe(e) {
              return function (t) {
                return (E(t, "input") || E(t, "button")) && t.type === e;
              };
            }
            function ie(e) {
              return function (t) {
                return "form" in t
                  ? t.parentNode && !1 === t.disabled
                    ? "label" in t
                      ? "label" in t.parentNode
                        ? t.parentNode.disabled === e
                        : t.disabled === e
                      : t.isDisabled === e ||
                        (t.isDisabled !== !e && K(t) === e)
                    : t.disabled === e
                  : "label" in t && t.disabled === e;
              };
            }
            function se(e) {
              return te(function (t) {
                return (
                  (t = +t),
                  te(function (n, r) {
                    for (var o, i = e([], n.length, t), s = i.length; s--; )
                      n[(o = i[s])] && (n[o] = !(r[o] = n[o]));
                  })
                );
              });
            }
            function ae(e) {
              return e && void 0 !== e.getElementsByTagName && e;
            }
            function ue(e) {
              var t,
                n = e ? e.ownerDocument || e : R;
              return n != c && 9 === n.nodeType && n.documentElement
                ? ((d = (c = n).documentElement),
                  (p = !C.isXMLDoc(c)),
                  (g =
                    d.matches ||
                    d.webkitMatchesSelector ||
                    d.msMatchesSelector),
                  d.msMatchesSelector &&
                    R != c &&
                    (t = c.defaultView) &&
                    t.top !== t &&
                    t.addEventListener("unload", J),
                  (f.getById = ne(function (e) {
                    return (
                      (d.appendChild(e).id = C.expando),
                      !c.getElementsByName ||
                        !c.getElementsByName(C.expando).length
                    );
                  })),
                  (f.disconnectedMatch = ne(function (e) {
                    return g.call(e, "*");
                  })),
                  (f.scope = ne(function () {
                    return c.querySelectorAll(":scope");
                  })),
                  (f.cssHas = ne(function () {
                    try {
                      return c.querySelector(":has(*,:jqfake)"), !1;
                    } catch (xe) {
                      return !0;
                    }
                  })),
                  f.getById
                    ? ((r.filter.ID = function (e) {
                        var t = e.replace(Q, Y);
                        return function (e) {
                          return e.getAttribute("id") === t;
                        };
                      }),
                      (r.find.ID = function (e, t) {
                        if (void 0 !== t.getElementById && p) {
                          var n = t.getElementById(e);
                          return n ? [n] : [];
                        }
                      }))
                    : ((r.filter.ID = function (e) {
                        var t = e.replace(Q, Y);
                        return function (e) {
                          var n =
                            void 0 !== e.getAttributeNode &&
                            e.getAttributeNode("id");
                          return n && n.value === t;
                        };
                      }),
                      (r.find.ID = function (e, t) {
                        if (void 0 !== t.getElementById && p) {
                          var n,
                            r,
                            o,
                            i = t.getElementById(e);
                          if (i) {
                            if ((n = i.getAttributeNode("id")) && n.value === e)
                              return [i];
                            for (
                              o = t.getElementsByName(e), r = 0;
                              (i = o[r++]);

                            )
                              if (
                                (n = i.getAttributeNode("id")) &&
                                n.value === e
                              )
                                return [i];
                          }
                          return [];
                        }
                      })),
                  (r.find.TAG = function (e, t) {
                    return void 0 !== t.getElementsByTagName
                      ? t.getElementsByTagName(e)
                      : t.querySelectorAll(e);
                  }),
                  (r.find.CLASS = function (e, t) {
                    if (void 0 !== t.getElementsByClassName && p)
                      return t.getElementsByClassName(e);
                  }),
                  (h = []),
                  ne(function (e) {
                    var t;
                    (d.appendChild(e).innerHTML =
                      "<a id='" +
                      y +
                      "' href='' disabled='disabled'></a><select id='" +
                      y +
                      "-\r\\' disabled='disabled'><option selected=''></option></select>"),
                      e.querySelectorAll("[selected]").length ||
                        h.push("\\[" + A + "*(?:value|" + $ + ")"),
                      e.querySelectorAll("[id~=" + y + "-]").length ||
                        h.push("~="),
                      e.querySelectorAll("a#" + y + "+*").length ||
                        h.push(".#.+[+~]"),
                      e.querySelectorAll(":checked").length ||
                        h.push(":checked"),
                      (t = c.createElement("input")).setAttribute(
                        "type",
                        "hidden",
                      ),
                      e.appendChild(t).setAttribute("name", "D"),
                      (d.appendChild(e).disabled = !0),
                      2 !== e.querySelectorAll(":disabled").length &&
                        h.push(":enabled", ":disabled"),
                      (t = c.createElement("input")).setAttribute("name", ""),
                      e.appendChild(t),
                      e.querySelectorAll("[name='']").length ||
                        h.push(
                          "\\[" + A + "*name" + A + "*=" + A + "*(?:''|\"\")",
                        );
                  }),
                  f.cssHas || h.push(":has"),
                  (h = h.length && new RegExp(h.join("|"))),
                  (N = function (e, t) {
                    if (e === t) return (u = !0), 0;
                    var n =
                      !e.compareDocumentPosition - !t.compareDocumentPosition;
                    return (
                      n ||
                      (1 &
                        (n =
                          (e.ownerDocument || e) == (t.ownerDocument || t)
                            ? e.compareDocumentPosition(t)
                            : 1) ||
                      (!f.sortDetached && t.compareDocumentPosition(e) === n)
                        ? e === c || (e.ownerDocument == R && Z.contains(R, e))
                          ? -1
                          : t === c ||
                              (t.ownerDocument == R && Z.contains(R, t))
                            ? 1
                            : s
                              ? a.call(s, e) - a.call(s, t)
                              : 0
                        : 4 & n
                          ? -1
                          : 1)
                    );
                  }),
                  c)
                : c;
            }
            for (t in ((Z.matches = function (e, t) {
              return Z(e, null, null, t);
            }),
            (Z.matchesSelector = function (e, t) {
              if ((ue(e), p && !j[t + " "] && (!h || !h.test(t))))
                try {
                  var n = g.call(e, t);
                  if (
                    n ||
                    f.disconnectedMatch ||
                    (e.document && 11 !== e.document.nodeType)
                  )
                    return n;
                } catch (xe) {
                  j(t, !0);
                }
              return Z(t, c, null, [e]).length > 0;
            }),
            (Z.contains = function (e, t) {
              return (e.ownerDocument || e) != c && ue(e), C.contains(e, t);
            }),
            (Z.attr = function (e, t) {
              (e.ownerDocument || e) != c && ue(e);
              var n = r.attrHandle[t.toLowerCase()],
                o =
                  n && l.call(r.attrHandle, t.toLowerCase())
                    ? n(e, t, !p)
                    : void 0;
              return void 0 !== o ? o : e.getAttribute(t);
            }),
            (Z.error = function (e) {
              throw new Error("Syntax error, unrecognized expression: " + e);
            }),
            (C.uniqueSort = function (e) {
              var t,
                n = [],
                r = 0,
                i = 0;
              if (
                ((u = !f.sortStable),
                (s = !f.sortStable && o.call(e, 0)),
                k.call(e, N),
                u)
              ) {
                for (; (t = e[i++]); ) t === e[i] && (r = n.push(i));
                for (; r--; ) I.call(e, n[r], 1);
              }
              return (s = null), e;
            }),
            (C.fn.uniqueSort = function () {
              return this.pushStack(C.uniqueSort(o.apply(this)));
            }),
            ((r = C.expr =
              {
                cacheLength: 50,
                createPseudo: te,
                match: V,
                attrHandle: {},
                find: {},
                relative: {
                  ">": { dir: "parentNode", first: !0 },
                  " ": { dir: "parentNode" },
                  "+": { dir: "previousSibling", first: !0 },
                  "~": { dir: "previousSibling" },
                },
                preFilter: {
                  ATTR: function (e) {
                    return (
                      (e[1] = e[1].replace(Q, Y)),
                      (e[3] = (e[3] || e[4] || e[5] || "").replace(Q, Y)),
                      "~=" === e[2] && (e[3] = " " + e[3] + " "),
                      e.slice(0, 4)
                    );
                  },
                  CHILD: function (e) {
                    return (
                      (e[1] = e[1].toLowerCase()),
                      "nth" === e[1].slice(0, 3)
                        ? (e[3] || Z.error(e[0]),
                          (e[4] = +(e[4]
                            ? e[5] + (e[6] || 1)
                            : 2 * ("even" === e[3] || "odd" === e[3]))),
                          (e[5] = +(e[7] + e[8] || "odd" === e[3])))
                        : e[3] && Z.error(e[0]),
                      e
                    );
                  },
                  PSEUDO: function (e) {
                    var t,
                      n = !e[6] && e[2];
                    return V.CHILD.test(e[0])
                      ? null
                      : (e[3]
                          ? (e[2] = e[4] || e[5] || "")
                          : n &&
                            B.test(n) &&
                            (t = le(n, !0)) &&
                            (t = n.indexOf(")", n.length - t) - n.length) &&
                            ((e[0] = e[0].slice(0, t)), (e[2] = n.slice(0, t))),
                        e.slice(0, 3));
                  },
                },
                filter: {
                  TAG: function (e) {
                    var t = e.replace(Q, Y).toLowerCase();
                    return "*" === e
                      ? function () {
                          return !0;
                        }
                      : function (e) {
                          return E(e, t);
                        };
                  },
                  CLASS: function (e) {
                    var t = w[e + " "];
                    return (
                      t ||
                      ((t = new RegExp(
                        "(^|" + A + ")" + e + "(" + A + "|$)",
                      )) &&
                        w(e, function (e) {
                          return t.test(
                            ("string" == typeof e.className && e.className) ||
                              (void 0 !== e.getAttribute &&
                                e.getAttribute("class")) ||
                              "",
                          );
                        }))
                    );
                  },
                  ATTR: function (e, t, n) {
                    return function (r) {
                      var o = Z.attr(r, e);
                      return null == o
                        ? "!=" === t
                        : !t ||
                            ((o += ""),
                            "=" === t
                              ? o === n
                              : "!=" === t
                                ? o !== n
                                : "^=" === t
                                  ? n && 0 === o.indexOf(n)
                                  : "*=" === t
                                    ? n && o.indexOf(n) > -1
                                    : "$=" === t
                                      ? n && o.slice(-n.length) === n
                                      : "~=" === t
                                        ? (
                                            " " +
                                            o.replace(L, " ") +
                                            " "
                                          ).indexOf(n) > -1
                                        : "|=" === t &&
                                          (o === n ||
                                            o.slice(0, n.length + 1) ===
                                              n + "-"));
                    };
                  },
                  CHILD: function (e, t, n, r, o) {
                    var i = "nth" !== e.slice(0, 3),
                      s = "last" !== e.slice(-4),
                      a = "of-type" === t;
                    return 1 === r && 0 === o
                      ? function (e) {
                          return !!e.parentNode;
                        }
                      : function (t, n, u) {
                          var c,
                            l,
                            d,
                            p,
                            f,
                            h = i !== s ? "nextSibling" : "previousSibling",
                            g = t.parentNode,
                            m = a && t.nodeName.toLowerCase(),
                            x = !u && !a,
                            w = !1;
                          if (g) {
                            if (i) {
                              for (; h; ) {
                                for (d = t; (d = d[h]); )
                                  if (a ? E(d, m) : 1 === d.nodeType) return !1;
                                f = h = "only" === e && !f && "nextSibling";
                              }
                              return !0;
                            }
                            if (
                              ((f = [s ? g.firstChild : g.lastChild]), s && x)
                            ) {
                              for (
                                w =
                                  (p =
                                    (c =
                                      (l = g[y] || (g[y] = {}))[e] || [])[0] ===
                                      v && c[1]) && c[2],
                                  d = p && g.childNodes[p];
                                (d =
                                  (++p && d && d[h]) || (w = p = 0) || f.pop());

                              )
                                if (1 === d.nodeType && ++w && d === t) {
                                  l[e] = [v, p, w];
                                  break;
                                }
                            } else if (
                              (x &&
                                (w = p =
                                  (c =
                                    (l = t[y] || (t[y] = {}))[e] || [])[0] ===
                                    v && c[1]),
                              !1 === w)
                            )
                              for (
                                ;
                                (d =
                                  (++p && d && d[h]) ||
                                  (w = p = 0) ||
                                  f.pop()) &&
                                (!(a ? E(d, m) : 1 === d.nodeType) ||
                                  !++w ||
                                  (x && ((l = d[y] || (d[y] = {}))[e] = [v, w]),
                                  d !== t));

                              );
                            return (
                              (w -= o) === r || (w % r === 0 && w / r >= 0)
                            );
                          }
                        };
                  },
                  PSEUDO: function (e, t) {
                    var n,
                      o =
                        r.pseudos[e] ||
                        r.setFilters[e.toLowerCase()] ||
                        Z.error("unsupported pseudo: " + e);
                    return o[y]
                      ? o(t)
                      : o.length > 1
                        ? ((n = [e, e, "", t]),
                          r.setFilters.hasOwnProperty(e.toLowerCase())
                            ? te(function (e, n) {
                                for (var r, i = o(e, t), s = i.length; s--; )
                                  e[(r = a.call(e, i[s]))] = !(n[r] = i[s]);
                              })
                            : function (e) {
                                return o(e, 0, n);
                              })
                        : o;
                  },
                },
                pseudos: {
                  not: te(function (e) {
                    var t = [],
                      n = [],
                      r = ye(e.replace(D, "$1"));
                    return r[y]
                      ? te(function (e, t, n, o) {
                          for (
                            var i, s = r(e, null, o, []), a = e.length;
                            a--;

                          )
                            (i = s[a]) && (e[a] = !(t[a] = i));
                        })
                      : function (e, o, i) {
                          return (
                            (t[0] = e),
                            r(t, null, i, n),
                            (t[0] = null),
                            !n.pop()
                          );
                        };
                  }),
                  has: te(function (e) {
                    return function (t) {
                      return Z(e, t).length > 0;
                    };
                  }),
                  contains: te(function (e) {
                    return (
                      (e = e.replace(Q, Y)),
                      function (t) {
                        return (t.textContent || C.text(t)).indexOf(e) > -1;
                      }
                    );
                  }),
                  lang: te(function (e) {
                    return (
                      W.test(e || "") || Z.error("unsupported lang: " + e),
                      (e = e.replace(Q, Y).toLowerCase()),
                      function (t) {
                        var n;
                        do {
                          if (
                            (n = p
                              ? t.lang
                              : t.getAttribute("xml:lang") ||
                                t.getAttribute("lang"))
                          )
                            return (
                              (n = n.toLowerCase()) === e ||
                              0 === n.indexOf(e + "-")
                            );
                        } while ((t = t.parentNode) && 1 === t.nodeType);
                        return !1;
                      }
                    );
                  }),
                  target: function (t) {
                    var n = e.location && e.location.hash;
                    return n && n.slice(1) === t.id;
                  },
                  root: function (e) {
                    return e === d;
                  },
                  focus: function (e) {
                    return (
                      e ===
                        (function () {
                          try {
                            return c.activeElement;
                          } catch (e) {}
                        })() &&
                      c.hasFocus() &&
                      !!(e.type || e.href || ~e.tabIndex)
                    );
                  },
                  enabled: ie(!1),
                  disabled: ie(!0),
                  checked: function (e) {
                    return (
                      (E(e, "input") && !!e.checked) ||
                      (E(e, "option") && !!e.selected)
                    );
                  },
                  selected: function (e) {
                    return (
                      e.parentNode && e.parentNode.selectedIndex,
                      !0 === e.selected
                    );
                  },
                  empty: function (e) {
                    for (e = e.firstChild; e; e = e.nextSibling)
                      if (e.nodeType < 6) return !1;
                    return !0;
                  },
                  parent: function (e) {
                    return !r.pseudos.empty(e);
                  },
                  header: function (e) {
                    return z.test(e.nodeName);
                  },
                  input: function (e) {
                    return U.test(e.nodeName);
                  },
                  button: function (e) {
                    return (
                      (E(e, "input") && "button" === e.type) || E(e, "button")
                    );
                  },
                  text: function (e) {
                    var t;
                    return (
                      E(e, "input") &&
                      "text" === e.type &&
                      (null == (t = e.getAttribute("type")) ||
                        "text" === t.toLowerCase())
                    );
                  },
                  first: se(function () {
                    return [0];
                  }),
                  last: se(function (e, t) {
                    return [t - 1];
                  }),
                  eq: se(function (e, t, n) {
                    return [n < 0 ? n + t : n];
                  }),
                  even: se(function (e, t) {
                    for (var n = 0; n < t; n += 2) e.push(n);
                    return e;
                  }),
                  odd: se(function (e, t) {
                    for (var n = 1; n < t; n += 2) e.push(n);
                    return e;
                  }),
                  lt: se(function (e, t, n) {
                    var r;
                    for (r = n < 0 ? n + t : n > t ? t : n; --r >= 0; )
                      e.push(r);
                    return e;
                  }),
                  gt: se(function (e, t, n) {
                    for (var r = n < 0 ? n + t : n; ++r < t; ) e.push(r);
                    return e;
                  }),
                },
              }).pseudos.nth = r.pseudos.eq),
            { radio: !0, checkbox: !0, file: !0, password: !0, image: !0 }))
              r.pseudos[t] = re(t);
            for (t in { submit: !0, reset: !0 }) r.pseudos[t] = oe(t);
            function ce() {}
            function le(e, t) {
              var n,
                o,
                i,
                s,
                a,
                u,
                c,
                l = b[e + " "];
              if (l) return t ? 0 : l.slice(0);
              for (a = e, u = [], c = r.preFilter; a; ) {
                for (s in ((n && !(o = q.exec(a))) ||
                  (o && (a = a.slice(o[0].length) || a), u.push((i = []))),
                (n = !1),
                (o = F.exec(a)) &&
                  ((n = o.shift()),
                  i.push({ value: n, type: o[0].replace(D, " ") }),
                  (a = a.slice(n.length))),
                r.filter))
                  !(o = V[s].exec(a)) ||
                    (c[s] && !(o = c[s](o))) ||
                    ((n = o.shift()),
                    i.push({ value: n, type: s, matches: o }),
                    (a = a.slice(n.length)));
                if (!n) break;
              }
              return t ? a.length : a ? Z.error(e) : b(e, u).slice(0);
            }
            function de(e) {
              for (var t = 0, n = e.length, r = ""; t < n; t++) r += e[t].value;
              return r;
            }
            function pe(e, t, n) {
              var r = t.dir,
                o = t.next,
                i = o || r,
                s = n && "parentNode" === i,
                a = x++;
              return t.first
                ? function (t, n, o) {
                    for (; (t = t[r]); )
                      if (1 === t.nodeType || s) return e(t, n, o);
                    return !1;
                  }
                : function (t, n, u) {
                    var c,
                      l,
                      d = [v, a];
                    if (u) {
                      for (; (t = t[r]); )
                        if ((1 === t.nodeType || s) && e(t, n, u)) return !0;
                    } else
                      for (; (t = t[r]); )
                        if (1 === t.nodeType || s)
                          if (((l = t[y] || (t[y] = {})), o && E(t, o)))
                            t = t[r] || t;
                          else {
                            if ((c = l[i]) && c[0] === v && c[1] === a)
                              return (d[2] = c[2]);
                            if (((l[i] = d), (d[2] = e(t, n, u)))) return !0;
                          }
                    return !1;
                  };
            }
            function fe(e) {
              return e.length > 1
                ? function (t, n, r) {
                    for (var o = e.length; o--; ) if (!e[o](t, n, r)) return !1;
                    return !0;
                  }
                : e[0];
            }
            function he(e, t, n, r, o) {
              for (
                var i, s = [], a = 0, u = e.length, c = null != t;
                a < u;
                a++
              )
                (i = e[a]) &&
                  ((n && !n(i, r, o)) || (s.push(i), c && t.push(a)));
              return s;
            }
            function ge(e, t, n, r, o, i) {
              return (
                r && !r[y] && (r = ge(r)),
                o && !o[y] && (o = ge(o, i)),
                te(function (i, s, u, c) {
                  var l,
                    d,
                    p,
                    f,
                    h = [],
                    g = [],
                    y = s.length,
                    v =
                      i ||
                      (function (e, t, n) {
                        for (var r = 0, o = t.length; r < o; r++) Z(e, t[r], n);
                        return n;
                      })(t || "*", u.nodeType ? [u] : u, []),
                    x = !e || (!i && t) ? v : he(v, h, e, u, c);
                  if (
                    (n
                      ? n(x, (f = o || (i ? e : y || r) ? [] : s), u, c)
                      : (f = x),
                    r)
                  )
                    for (l = he(f, g), r(l, [], u, c), d = l.length; d--; )
                      (p = l[d]) && (f[g[d]] = !(x[g[d]] = p));
                  if (i) {
                    if (o || e) {
                      if (o) {
                        for (l = [], d = f.length; d--; )
                          (p = f[d]) && l.push((x[d] = p));
                        o(null, (f = []), l, c);
                      }
                      for (d = f.length; d--; )
                        (p = f[d]) &&
                          (l = o ? a.call(i, p) : h[d]) > -1 &&
                          (i[l] = !(s[l] = p));
                    }
                  } else
                    (f = he(f === s ? f.splice(y, f.length) : f)),
                      o ? o(null, s, f, c) : m.apply(s, f);
                })
              );
            }
            function me(e) {
              for (
                var t,
                  n,
                  o,
                  s = e.length,
                  u = r.relative[e[0].type],
                  c = u || r.relative[" "],
                  l = u ? 1 : 0,
                  d = pe(
                    function (e) {
                      return e === t;
                    },
                    c,
                    !0,
                  ),
                  p = pe(
                    function (e) {
                      return a.call(t, e) > -1;
                    },
                    c,
                    !0,
                  ),
                  f = [
                    function (e, n, r) {
                      var o =
                        (!u && (r || n != i)) ||
                        ((t = n).nodeType ? d(e, n, r) : p(e, n, r));
                      return (t = null), o;
                    },
                  ];
                l < s;
                l++
              )
                if ((n = r.relative[e[l].type])) f = [pe(fe(f), n)];
                else {
                  if ((n = r.filter[e[l].type].apply(null, e[l].matches))[y]) {
                    for (o = ++l; o < s && !r.relative[e[o].type]; o++);
                    return ge(
                      l > 1 && fe(f),
                      l > 1 &&
                        de(
                          e
                            .slice(0, l - 1)
                            .concat({
                              value: " " === e[l - 2].type ? "*" : "",
                            }),
                        ).replace(D, "$1"),
                      n,
                      l < o && me(e.slice(l, o)),
                      o < s && me((e = e.slice(o))),
                      o < s && de(e),
                    );
                  }
                  f.push(n);
                }
              return fe(f);
            }
            function ye(e, t) {
              var n,
                o = [],
                s = [],
                a = T[e + " "];
              if (!a) {
                for (t || (t = le(e)), n = t.length; n--; )
                  (a = me(t[n]))[y] ? o.push(a) : s.push(a);
                (a = T(
                  e,
                  (function (e, t) {
                    var n = t.length > 0,
                      o = e.length > 0,
                      s = function (s, a, u, l, d) {
                        var f,
                          h,
                          g,
                          y = 0,
                          x = "0",
                          w = s && [],
                          b = [],
                          T = i,
                          E = s || (o && r.find.TAG("*", d)),
                          k = (v += null == T ? 1 : Math.random() || 0.1),
                          I = E.length;
                        for (
                          d && (i = a == c || a || d);
                          x !== I && null != (f = E[x]);
                          x++
                        ) {
                          if (o && f) {
                            for (
                              h = 0,
                                a || f.ownerDocument == c || (ue(f), (u = !p));
                              (g = e[h++]);

                            )
                              if (g(f, a || c, u)) {
                                m.call(l, f);
                                break;
                              }
                            d && (v = k);
                          }
                          n && ((f = !g && f) && y--, s && w.push(f));
                        }
                        if (((y += x), n && x !== y)) {
                          for (h = 0; (g = t[h++]); ) g(w, b, a, u);
                          if (s) {
                            if (y > 0)
                              for (; x--; ) w[x] || b[x] || (b[x] = S.call(l));
                            b = he(b);
                          }
                          m.apply(l, b),
                            d &&
                              !s &&
                              b.length > 0 &&
                              y + t.length > 1 &&
                              C.uniqueSort(l);
                        }
                        return d && ((v = k), (i = T)), w;
                      };
                    return n ? te(s) : s;
                  })(s, o),
                )),
                  (a.selector = e);
              }
              return a;
            }
            function ve(e, t, n, o) {
              var i,
                s,
                a,
                u,
                c,
                l = "function" == typeof e && e,
                d = !o && le((e = l.selector || e));
              if (((n = n || []), 1 === d.length)) {
                if (
                  (s = d[0] = d[0].slice(0)).length > 2 &&
                  "ID" === (a = s[0]).type &&
                  9 === t.nodeType &&
                  p &&
                  r.relative[s[1].type]
                ) {
                  if (
                    !(t = (r.find.ID(a.matches[0].replace(Q, Y), t) || [])[0])
                  )
                    return n;
                  l && (t = t.parentNode),
                    (e = e.slice(s.shift().value.length));
                }
                for (
                  i = V.needsContext.test(e) ? 0 : s.length;
                  i-- && ((a = s[i]), !r.relative[(u = a.type)]);

                )
                  if (
                    (c = r.find[u]) &&
                    (o = c(
                      a.matches[0].replace(Q, Y),
                      (X.test(s[0].type) && ae(t.parentNode)) || t,
                    ))
                  ) {
                    if ((s.splice(i, 1), !(e = o.length && de(s))))
                      return m.apply(n, o), n;
                    break;
                  }
              }
              return (
                (l || ye(e, d))(
                  o,
                  t,
                  !p,
                  n,
                  !t || (X.test(e) && ae(t.parentNode)) || t,
                ),
                n
              );
            }
            (ce.prototype = r.filters = r.pseudos),
              (r.setFilters = new ce()),
              (f.sortStable = y.split("").sort(N).join("") === y),
              ue(),
              (f.sortDetached = ne(function (e) {
                return (
                  1 & e.compareDocumentPosition(c.createElement("fieldset"))
                );
              })),
              (C.find = Z),
              (C.expr[":"] = C.expr.pseudos),
              (C.unique = C.uniqueSort),
              (Z.compile = ye),
              (Z.select = ve),
              (Z.setDocument = ue),
              (Z.tokenize = le),
              (Z.escape = C.escapeSelector),
              (Z.getText = C.text),
              (Z.isXML = C.isXMLDoc),
              (Z.selectors = C.expr),
              (Z.support = C.support),
              (Z.uniqueSort = C.uniqueSort);
          })();
          var $ = function (e, t, n) {
              for (
                var r = [], o = void 0 !== n;
                (e = e[t]) && 9 !== e.nodeType;

              )
                if (1 === e.nodeType) {
                  if (o && C(e).is(n)) break;
                  r.push(e);
                }
              return r;
            },
            _ = function (e, t) {
              for (var n = []; e; e = e.nextSibling)
                1 === e.nodeType && e !== t && n.push(e);
              return n;
            },
            M = C.expr.match.needsContext,
            O =
              /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i;
          function L(e, t, n) {
            return h(t)
              ? C.grep(e, function (e, r) {
                  return !!t.call(e, r, e) !== n;
                })
              : t.nodeType
                ? C.grep(e, function (e) {
                    return (e === t) !== n;
                  })
                : "string" != typeof t
                  ? C.grep(e, function (e) {
                      return a.call(t, e) > -1 !== n;
                    })
                  : C.filter(t, e, n);
          }
          (C.filter = function (e, t, n) {
            var r = t[0];
            return (
              n && (e = ":not(" + e + ")"),
              1 === t.length && 1 === r.nodeType
                ? C.find.matchesSelector(r, e)
                  ? [r]
                  : []
                : C.find.matches(
                    e,
                    C.grep(t, function (e) {
                      return 1 === e.nodeType;
                    }),
                  )
            );
          }),
            C.fn.extend({
              find: function (e) {
                var t,
                  n,
                  r = this.length,
                  o = this;
                if ("string" != typeof e)
                  return this.pushStack(
                    C(e).filter(function () {
                      for (t = 0; t < r; t++)
                        if (C.contains(o[t], this)) return !0;
                    }),
                  );
                for (n = this.pushStack([]), t = 0; t < r; t++)
                  C.find(e, o[t], n);
                return r > 1 ? C.uniqueSort(n) : n;
              },
              filter: function (e) {
                return this.pushStack(L(this, e || [], !1));
              },
              not: function (e) {
                return this.pushStack(L(this, e || [], !0));
              },
              is: function (e) {
                return !!L(
                  this,
                  "string" == typeof e && M.test(e) ? C(e) : e || [],
                  !1,
                ).length;
              },
            });
          var q,
            F = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/;
          ((C.fn.init = function (e, t, n) {
            var r, o;
            if (!e) return this;
            if (((n = n || q), "string" == typeof e)) {
              if (
                !(r =
                  "<" === e[0] && ">" === e[e.length - 1] && e.length >= 3
                    ? [null, e, null]
                    : F.exec(e)) ||
                (!r[1] && t)
              )
                return !t || t.jquery
                  ? (t || n).find(e)
                  : this.constructor(t).find(e);
              if (r[1]) {
                if (
                  ((t = t instanceof C ? t[0] : t),
                  C.merge(
                    this,
                    C.parseHTML(
                      r[1],
                      t && t.nodeType ? t.ownerDocument || t : m,
                      !0,
                    ),
                  ),
                  O.test(r[1]) && C.isPlainObject(t))
                )
                  for (r in t) h(this[r]) ? this[r](t[r]) : this.attr(r, t[r]);
                return this;
              }
              return (
                (o = m.getElementById(r[2])) &&
                  ((this[0] = o), (this.length = 1)),
                this
              );
            }
            return e.nodeType
              ? ((this[0] = e), (this.length = 1), this)
              : h(e)
                ? void 0 !== n.ready
                  ? n.ready(e)
                  : e(C)
                : C.makeArray(e, this);
          }).prototype = C.fn),
            (q = C(m));
          var H = /^(?:parents|prev(?:Until|All))/,
            B = { children: !0, contents: !0, next: !0, prev: !0 };
          function W(e, t) {
            for (; (e = e[t]) && 1 !== e.nodeType; );
            return e;
          }
          C.fn.extend({
            has: function (e) {
              var t = C(e, this),
                n = t.length;
              return this.filter(function () {
                for (var e = 0; e < n; e++)
                  if (C.contains(this, t[e])) return !0;
              });
            },
            closest: function (e, t) {
              var n,
                r = 0,
                o = this.length,
                i = [],
                s = "string" != typeof e && C(e);
              if (!M.test(e))
                for (; r < o; r++)
                  for (n = this[r]; n && n !== t; n = n.parentNode)
                    if (
                      n.nodeType < 11 &&
                      (s
                        ? s.index(n) > -1
                        : 1 === n.nodeType && C.find.matchesSelector(n, e))
                    ) {
                      i.push(n);
                      break;
                    }
              return this.pushStack(i.length > 1 ? C.uniqueSort(i) : i);
            },
            index: function (e) {
              return e
                ? "string" == typeof e
                  ? a.call(C(e), this[0])
                  : a.call(this, e.jquery ? e[0] : e)
                : this[0] && this[0].parentNode
                  ? this.first().prevAll().length
                  : -1;
            },
            add: function (e, t) {
              return this.pushStack(C.uniqueSort(C.merge(this.get(), C(e, t))));
            },
            addBack: function (e) {
              return this.add(
                null == e ? this.prevObject : this.prevObject.filter(e),
              );
            },
          }),
            C.each(
              {
                parent: function (e) {
                  var t = e.parentNode;
                  return t && 11 !== t.nodeType ? t : null;
                },
                parents: function (e) {
                  return $(e, "parentNode");
                },
                parentsUntil: function (e, t, n) {
                  return $(e, "parentNode", n);
                },
                next: function (e) {
                  return W(e, "nextSibling");
                },
                prev: function (e) {
                  return W(e, "previousSibling");
                },
                nextAll: function (e) {
                  return $(e, "nextSibling");
                },
                prevAll: function (e) {
                  return $(e, "previousSibling");
                },
                nextUntil: function (e, t, n) {
                  return $(e, "nextSibling", n);
                },
                prevUntil: function (e, t, n) {
                  return $(e, "previousSibling", n);
                },
                siblings: function (e) {
                  return _((e.parentNode || {}).firstChild, e);
                },
                children: function (e) {
                  return _(e.firstChild);
                },
                contents: function (e) {
                  return null != e.contentDocument && r(e.contentDocument)
                    ? e.contentDocument
                    : (E(e, "template") && (e = e.content || e),
                      C.merge([], e.childNodes));
                },
              },
              function (e, t) {
                C.fn[e] = function (n, r) {
                  var o = C.map(this, t, n);
                  return (
                    "Until" !== e.slice(-5) && (r = n),
                    r && "string" == typeof r && (o = C.filter(r, o)),
                    this.length > 1 &&
                      (B[e] || C.uniqueSort(o), H.test(e) && o.reverse()),
                    this.pushStack(o)
                  );
                };
              },
            );
          var V = /[^\x20\t\r\n\f]+/g;
          function U(e) {
            return e;
          }
          function z(e) {
            throw e;
          }
          function G(e, t, n, r) {
            var o;
            try {
              e && h((o = e.promise))
                ? o.call(e).done(t).fail(n)
                : e && h((o = e.then))
                  ? o.call(e, t, n)
                  : t.apply(void 0, [e].slice(r));
            } catch (i) {
              n.apply(void 0, [i]);
            }
          }
          (C.Callbacks = function (e) {
            e =
              "string" == typeof e
                ? (function (e) {
                    var t = {};
                    return (
                      C.each(e.match(V) || [], function (e, n) {
                        t[n] = !0;
                      }),
                      t
                    );
                  })(e)
                : C.extend({}, e);
            var t,
              n,
              r,
              o,
              i = [],
              s = [],
              a = -1,
              u = function () {
                for (o = o || e.once, r = t = !0; s.length; a = -1)
                  for (n = s.shift(); ++a < i.length; )
                    !1 === i[a].apply(n[0], n[1]) &&
                      e.stopOnFalse &&
                      ((a = i.length), (n = !1));
                e.memory || (n = !1), (t = !1), o && (i = n ? [] : "");
              },
              c = {
                add: function () {
                  return (
                    i &&
                      (n && !t && ((a = i.length - 1), s.push(n)),
                      (function t(n) {
                        C.each(n, function (n, r) {
                          h(r)
                            ? (e.unique && c.has(r)) || i.push(r)
                            : r && r.length && "string" !== x(r) && t(r);
                        });
                      })(arguments),
                      n && !t && u()),
                    this
                  );
                },
                remove: function () {
                  return (
                    C.each(arguments, function (e, t) {
                      for (var n; (n = C.inArray(t, i, n)) > -1; )
                        i.splice(n, 1), n <= a && a--;
                    }),
                    this
                  );
                },
                has: function (e) {
                  return e ? C.inArray(e, i) > -1 : i.length > 0;
                },
                empty: function () {
                  return i && (i = []), this;
                },
                disable: function () {
                  return (o = s = []), (i = n = ""), this;
                },
                disabled: function () {
                  return !i;
                },
                lock: function () {
                  return (o = s = []), n || t || (i = n = ""), this;
                },
                locked: function () {
                  return !!o;
                },
                fireWith: function (e, n) {
                  return (
                    o ||
                      ((n = [e, (n = n || []).slice ? n.slice() : n]),
                      s.push(n),
                      t || u()),
                    this
                  );
                },
                fire: function () {
                  return c.fireWith(this, arguments), this;
                },
                fired: function () {
                  return !!r;
                },
              };
            return c;
          }),
            C.extend({
              Deferred: function (t) {
                var n = [
                    [
                      "notify",
                      "progress",
                      C.Callbacks("memory"),
                      C.Callbacks("memory"),
                      2,
                    ],
                    [
                      "resolve",
                      "done",
                      C.Callbacks("once memory"),
                      C.Callbacks("once memory"),
                      0,
                      "resolved",
                    ],
                    [
                      "reject",
                      "fail",
                      C.Callbacks("once memory"),
                      C.Callbacks("once memory"),
                      1,
                      "rejected",
                    ],
                  ],
                  r = "pending",
                  o = {
                    state: function () {
                      return r;
                    },
                    always: function () {
                      return i.done(arguments).fail(arguments), this;
                    },
                    catch: function (e) {
                      return o.then(null, e);
                    },
                    pipe: function () {
                      var e = arguments;
                      return C.Deferred(function (t) {
                        C.each(n, function (n, r) {
                          var o = h(e[r[4]]) && e[r[4]];
                          i[r[1]](function () {
                            var e = o && o.apply(this, arguments);
                            e && h(e.promise)
                              ? e
                                  .promise()
                                  .progress(t.notify)
                                  .done(t.resolve)
                                  .fail(t.reject)
                              : t[r[0] + "With"](this, o ? [e] : arguments);
                          });
                        }),
                          (e = null);
                      }).promise();
                    },
                    then: function (t, r, o) {
                      var i = 0;
                      function s(t, n, r, o) {
                        return function () {
                          var a = this,
                            u = arguments,
                            c = function () {
                              var e, c;
                              if (!(t < i)) {
                                if ((e = r.apply(a, u)) === n.promise())
                                  throw new TypeError(
                                    "Thenable self-resolution",
                                  );
                                (c =
                                  e &&
                                  ("object" == typeof e ||
                                    "function" == typeof e) &&
                                  e.then),
                                  h(c)
                                    ? o
                                      ? c.call(e, s(i, n, U, o), s(i, n, z, o))
                                      : (i++,
                                        c.call(
                                          e,
                                          s(i, n, U, o),
                                          s(i, n, z, o),
                                          s(i, n, U, n.notifyWith),
                                        ))
                                    : (r !== U && ((a = void 0), (u = [e])),
                                      (o || n.resolveWith)(a, u));
                              }
                            },
                            l = o
                              ? c
                              : function () {
                                  try {
                                    c();
                                  } catch (e) {
                                    C.Deferred.exceptionHook &&
                                      C.Deferred.exceptionHook(e, l.error),
                                      t + 1 >= i &&
                                        (r !== z && ((a = void 0), (u = [e])),
                                        n.rejectWith(a, u));
                                  }
                                };
                          t
                            ? l()
                            : (C.Deferred.getErrorHook
                                ? (l.error = C.Deferred.getErrorHook())
                                : C.Deferred.getStackHook &&
                                  (l.error = C.Deferred.getStackHook()),
                              e.setTimeout(l));
                        };
                      }
                      return C.Deferred(function (e) {
                        n[0][3].add(s(0, e, h(o) ? o : U, e.notifyWith)),
                          n[1][3].add(s(0, e, h(t) ? t : U)),
                          n[2][3].add(s(0, e, h(r) ? r : z));
                      }).promise();
                    },
                    promise: function (e) {
                      return null != e ? C.extend(e, o) : o;
                    },
                  },
                  i = {};
                return (
                  C.each(n, function (e, t) {
                    var s = t[2],
                      a = t[5];
                    (o[t[1]] = s.add),
                      a &&
                        s.add(
                          function () {
                            r = a;
                          },
                          n[3 - e][2].disable,
                          n[3 - e][3].disable,
                          n[0][2].lock,
                          n[0][3].lock,
                        ),
                      s.add(t[3].fire),
                      (i[t[0]] = function () {
                        return (
                          i[t[0] + "With"](
                            this === i ? void 0 : this,
                            arguments,
                          ),
                          this
                        );
                      }),
                      (i[t[0] + "With"] = s.fireWith);
                  }),
                  o.promise(i),
                  t && t.call(i, i),
                  i
                );
              },
              when: function (e) {
                var t = arguments.length,
                  n = t,
                  r = Array(n),
                  i = o.call(arguments),
                  s = C.Deferred(),
                  a = function (e) {
                    return function (n) {
                      (r[e] = this),
                        (i[e] = arguments.length > 1 ? o.call(arguments) : n),
                        --t || s.resolveWith(r, i);
                    };
                  };
                if (
                  t <= 1 &&
                  (G(e, s.done(a(n)).resolve, s.reject, !t),
                  "pending" === s.state() || h(i[n] && i[n].then))
                )
                  return s.then();
                for (; n--; ) G(i[n], a(n), s.reject);
                return s.promise();
              },
            });
          var X = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;
          (C.Deferred.exceptionHook = function (t, n) {
            e.console &&
              e.console.warn &&
              t &&
              X.test(t.name) &&
              e.console.warn(
                "jQuery.Deferred exception: " + t.message,
                t.stack,
                n,
              );
          }),
            (C.readyException = function (t) {
              e.setTimeout(function () {
                throw t;
              });
            });
          var Q = C.Deferred();
          function Y() {
            m.removeEventListener("DOMContentLoaded", Y),
              e.removeEventListener("load", Y),
              C.ready();
          }
          (C.fn.ready = function (e) {
            return (
              Q.then(e).catch(function (e) {
                C.readyException(e);
              }),
              this
            );
          }),
            C.extend({
              isReady: !1,
              readyWait: 1,
              ready: function (e) {
                (!0 === e ? --C.readyWait : C.isReady) ||
                  ((C.isReady = !0),
                  (!0 !== e && --C.readyWait > 0) || Q.resolveWith(m, [C]));
              },
            }),
            (C.ready.then = Q.then),
            "complete" === m.readyState ||
            ("loading" !== m.readyState && !m.documentElement.doScroll)
              ? e.setTimeout(C.ready)
              : (m.addEventListener("DOMContentLoaded", Y),
                e.addEventListener("load", Y));
          var J = function (e, t, n, r, o, i, s) {
              var a = 0,
                u = e.length,
                c = null == n;
              if ("object" === x(n))
                for (a in ((o = !0), n)) J(e, t, a, n[a], !0, i, s);
              else if (
                void 0 !== r &&
                ((o = !0),
                h(r) || (s = !0),
                c &&
                  (s
                    ? (t.call(e, r), (t = null))
                    : ((c = t),
                      (t = function (e, t, n) {
                        return c.call(C(e), n);
                      }))),
                t)
              )
                for (; a < u; a++)
                  t(e[a], n, s ? r : r.call(e[a], a, t(e[a], n)));
              return o ? e : c ? t.call(e) : u ? t(e[0], n) : i;
            },
            K = /^-ms-/,
            Z = /-([a-z])/g;
          function ee(e, t) {
            return t.toUpperCase();
          }
          function te(e) {
            return e.replace(K, "ms-").replace(Z, ee);
          }
          var ne = function (e) {
            return 1 === e.nodeType || 9 === e.nodeType || !+e.nodeType;
          };
          function re() {
            this.expando = C.expando + re.uid++;
          }
          (re.uid = 1),
            (re.prototype = {
              cache: function (e) {
                var t = e[this.expando];
                return (
                  t ||
                    ((t = {}),
                    ne(e) &&
                      (e.nodeType
                        ? (e[this.expando] = t)
                        : Object.defineProperty(e, this.expando, {
                            value: t,
                            configurable: !0,
                          }))),
                  t
                );
              },
              set: function (e, t, n) {
                var r,
                  o = this.cache(e);
                if ("string" == typeof t) o[te(t)] = n;
                else for (r in t) o[te(r)] = t[r];
                return o;
              },
              get: function (e, t) {
                return void 0 === t
                  ? this.cache(e)
                  : e[this.expando] && e[this.expando][te(t)];
              },
              access: function (e, t, n) {
                return void 0 === t ||
                  (t && "string" == typeof t && void 0 === n)
                  ? this.get(e, t)
                  : (this.set(e, t, n), void 0 !== n ? n : t);
              },
              remove: function (e, t) {
                var n,
                  r = e[this.expando];
                if (void 0 !== r) {
                  if (void 0 !== t) {
                    n = (t = Array.isArray(t)
                      ? t.map(te)
                      : (t = te(t)) in r
                        ? [t]
                        : t.match(V) || []).length;
                    for (; n--; ) delete r[t[n]];
                  }
                  (void 0 === t || C.isEmptyObject(r)) &&
                    (e.nodeType
                      ? (e[this.expando] = void 0)
                      : delete e[this.expando]);
                }
              },
              hasData: function (e) {
                var t = e[this.expando];
                return void 0 !== t && !C.isEmptyObject(t);
              },
            });
          var oe = new re(),
            ie = new re(),
            se = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
            ae = /[A-Z]/g;
          function ue(e, t, n) {
            var r;
            if (void 0 === n && 1 === e.nodeType)
              if (
                ((r = "data-" + t.replace(ae, "-$&").toLowerCase()),
                "string" == typeof (n = e.getAttribute(r)))
              ) {
                try {
                  n = (function (e) {
                    return (
                      "true" === e ||
                      ("false" !== e &&
                        ("null" === e
                          ? null
                          : e === +e + ""
                            ? +e
                            : se.test(e)
                              ? JSON.parse(e)
                              : e))
                    );
                  })(n);
                } catch (o) {}
                ie.set(e, t, n);
              } else n = void 0;
            return n;
          }
          C.extend({
            hasData: function (e) {
              return ie.hasData(e) || oe.hasData(e);
            },
            data: function (e, t, n) {
              return ie.access(e, t, n);
            },
            removeData: function (e, t) {
              ie.remove(e, t);
            },
            _data: function (e, t, n) {
              return oe.access(e, t, n);
            },
            _removeData: function (e, t) {
              oe.remove(e, t);
            },
          }),
            C.fn.extend({
              data: function (e, t) {
                var n,
                  r,
                  o,
                  i = this[0],
                  s = i && i.attributes;
                if (void 0 === e) {
                  if (
                    this.length &&
                    ((o = ie.get(i)),
                    1 === i.nodeType && !oe.get(i, "hasDataAttrs"))
                  ) {
                    for (n = s.length; n--; )
                      s[n] &&
                        0 === (r = s[n].name).indexOf("data-") &&
                        ((r = te(r.slice(5))), ue(i, r, o[r]));
                    oe.set(i, "hasDataAttrs", !0);
                  }
                  return o;
                }
                return "object" == typeof e
                  ? this.each(function () {
                      ie.set(this, e);
                    })
                  : J(
                      this,
                      function (t) {
                        var n;
                        if (i && void 0 === t)
                          return void 0 !== (n = ie.get(i, e)) ||
                            void 0 !== (n = ue(i, e))
                            ? n
                            : void 0;
                        this.each(function () {
                          ie.set(this, e, t);
                        });
                      },
                      null,
                      t,
                      arguments.length > 1,
                      null,
                      !0,
                    );
              },
              removeData: function (e) {
                return this.each(function () {
                  ie.remove(this, e);
                });
              },
            }),
            C.extend({
              queue: function (e, t, n) {
                var r;
                if (e)
                  return (
                    (t = (t || "fx") + "queue"),
                    (r = oe.get(e, t)),
                    n &&
                      (!r || Array.isArray(n)
                        ? (r = oe.access(e, t, C.makeArray(n)))
                        : r.push(n)),
                    r || []
                  );
              },
              dequeue: function (e, t) {
                t = t || "fx";
                var n = C.queue(e, t),
                  r = n.length,
                  o = n.shift(),
                  i = C._queueHooks(e, t);
                "inprogress" === o && ((o = n.shift()), r--),
                  o &&
                    ("fx" === t && n.unshift("inprogress"),
                    delete i.stop,
                    o.call(
                      e,
                      function () {
                        C.dequeue(e, t);
                      },
                      i,
                    )),
                  !r && i && i.empty.fire();
              },
              _queueHooks: function (e, t) {
                var n = t + "queueHooks";
                return (
                  oe.get(e, n) ||
                  oe.access(e, n, {
                    empty: C.Callbacks("once memory").add(function () {
                      oe.remove(e, [t + "queue", n]);
                    }),
                  })
                );
              },
            }),
            C.fn.extend({
              queue: function (e, t) {
                var n = 2;
                return (
                  "string" != typeof e && ((t = e), (e = "fx"), n--),
                  arguments.length < n
                    ? C.queue(this[0], e)
                    : void 0 === t
                      ? this
                      : this.each(function () {
                          var n = C.queue(this, e, t);
                          C._queueHooks(this, e),
                            "fx" === e &&
                              "inprogress" !== n[0] &&
                              C.dequeue(this, e);
                        })
                );
              },
              dequeue: function (e) {
                return this.each(function () {
                  C.dequeue(this, e);
                });
              },
              clearQueue: function (e) {
                return this.queue(e || "fx", []);
              },
              promise: function (e, t) {
                var n,
                  r = 1,
                  o = C.Deferred(),
                  i = this,
                  s = this.length,
                  a = function () {
                    --r || o.resolveWith(i, [i]);
                  };
                for (
                  "string" != typeof e && ((t = e), (e = void 0)),
                    e = e || "fx";
                  s--;

                )
                  (n = oe.get(i[s], e + "queueHooks")) &&
                    n.empty &&
                    (r++, n.empty.add(a));
                return a(), o.promise(t);
              },
            });
          var ce = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,
            le = new RegExp("^(?:([+-])=|)(" + ce + ")([a-z%]*)$", "i"),
            de = ["Top", "Right", "Bottom", "Left"],
            pe = m.documentElement,
            fe = function (e) {
              return C.contains(e.ownerDocument, e);
            },
            he = { composed: !0 };
          pe.getRootNode &&
            (fe = function (e) {
              return (
                C.contains(e.ownerDocument, e) ||
                e.getRootNode(he) === e.ownerDocument
              );
            });
          var ge = function (e, t) {
            return (
              "none" === (e = t || e).style.display ||
              ("" === e.style.display &&
                fe(e) &&
                "none" === C.css(e, "display"))
            );
          };
          function me(e, t, n, r) {
            var o,
              i,
              s = 20,
              a = r
                ? function () {
                    return r.cur();
                  }
                : function () {
                    return C.css(e, t, "");
                  },
              u = a(),
              c = (n && n[3]) || (C.cssNumber[t] ? "" : "px"),
              l =
                e.nodeType &&
                (C.cssNumber[t] || ("px" !== c && +u)) &&
                le.exec(C.css(e, t));
            if (l && l[3] !== c) {
              for (u /= 2, c = c || l[3], l = +u || 1; s--; )
                C.style(e, t, l + c),
                  (1 - i) * (1 - (i = a() / u || 0.5)) <= 0 && (s = 0),
                  (l /= i);
              (l *= 2), C.style(e, t, l + c), (n = n || []);
            }
            return (
              n &&
                ((l = +l || +u || 0),
                (o = n[1] ? l + (n[1] + 1) * n[2] : +n[2]),
                r && ((r.unit = c), (r.start = l), (r.end = o))),
              o
            );
          }
          var ye = {};
          function ve(e) {
            var t,
              n = e.ownerDocument,
              r = e.nodeName,
              o = ye[r];
            return (
              o ||
              ((t = n.body.appendChild(n.createElement(r))),
              (o = C.css(t, "display")),
              t.parentNode.removeChild(t),
              "none" === o && (o = "block"),
              (ye[r] = o),
              o)
            );
          }
          function xe(e, t) {
            for (var n, r, o = [], i = 0, s = e.length; i < s; i++)
              (r = e[i]).style &&
                ((n = r.style.display),
                t
                  ? ("none" === n &&
                      ((o[i] = oe.get(r, "display") || null),
                      o[i] || (r.style.display = "")),
                    "" === r.style.display && ge(r) && (o[i] = ve(r)))
                  : "none" !== n && ((o[i] = "none"), oe.set(r, "display", n)));
            for (i = 0; i < s; i++) null != o[i] && (e[i].style.display = o[i]);
            return e;
          }
          C.fn.extend({
            show: function () {
              return xe(this, !0);
            },
            hide: function () {
              return xe(this);
            },
            toggle: function (e) {
              return "boolean" == typeof e
                ? e
                  ? this.show()
                  : this.hide()
                : this.each(function () {
                    ge(this) ? C(this).show() : C(this).hide();
                  });
            },
          });
          var we,
            be,
            Ce = /^(?:checkbox|radio)$/i,
            Te = /<([a-z][^\/\0>\x20\t\r\n\f]*)/i,
            Ee = /^$|^module$|\/(?:java|ecma)script/i;
          (we = m.createDocumentFragment().appendChild(m.createElement("div"))),
            (be = m.createElement("input")).setAttribute("type", "radio"),
            be.setAttribute("checked", "checked"),
            be.setAttribute("name", "t"),
            we.appendChild(be),
            (f.checkClone = we.cloneNode(!0).cloneNode(!0).lastChild.checked),
            (we.innerHTML = "<textarea>x</textarea>"),
            (f.noCloneChecked = !!we.cloneNode(!0).lastChild.defaultValue),
            (we.innerHTML = "<option></option>"),
            (f.option = !!we.lastChild);
          var Se = {
            thead: [1, "<table>", "</table>"],
            col: [2, "<table><colgroup>", "</colgroup></table>"],
            tr: [2, "<table><tbody>", "</tbody></table>"],
            td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],
            _default: [0, "", ""],
          };
          function ke(e, t) {
            var n;
            return (
              (n =
                void 0 !== e.getElementsByTagName
                  ? e.getElementsByTagName(t || "*")
                  : void 0 !== e.querySelectorAll
                    ? e.querySelectorAll(t || "*")
                    : []),
              void 0 === t || (t && E(e, t)) ? C.merge([e], n) : n
            );
          }
          function Ie(e, t) {
            for (var n = 0, r = e.length; n < r; n++)
              oe.set(e[n], "globalEval", !t || oe.get(t[n], "globalEval"));
          }
          (Se.tbody = Se.tfoot = Se.colgroup = Se.caption = Se.thead),
            (Se.th = Se.td),
            f.option ||
              (Se.optgroup = Se.option =
                [1, "<select multiple='multiple'>", "</select>"]);
          var Ae = /<|&#?\w+;/;
          function De(e, t, n, r, o) {
            for (
              var i,
                s,
                a,
                u,
                c,
                l,
                d = t.createDocumentFragment(),
                p = [],
                f = 0,
                h = e.length;
              f < h;
              f++
            )
              if ((i = e[f]) || 0 === i)
                if ("object" === x(i)) C.merge(p, i.nodeType ? [i] : i);
                else if (Ae.test(i)) {
                  for (
                    s = s || d.appendChild(t.createElement("div")),
                      a = (Te.exec(i) || ["", ""])[1].toLowerCase(),
                      u = Se[a] || Se._default,
                      s.innerHTML = u[1] + C.htmlPrefilter(i) + u[2],
                      l = u[0];
                    l--;

                  )
                    s = s.lastChild;
                  C.merge(p, s.childNodes),
                    ((s = d.firstChild).textContent = "");
                } else p.push(t.createTextNode(i));
            for (d.textContent = "", f = 0; (i = p[f++]); )
              if (r && C.inArray(i, r) > -1) o && o.push(i);
              else if (
                ((c = fe(i)),
                (s = ke(d.appendChild(i), "script")),
                c && Ie(s),
                n)
              )
                for (l = 0; (i = s[l++]); ) Ee.test(i.type || "") && n.push(i);
            return d;
          }
          var je = /^([^.]*)(?:\.(.+)|)/;
          function Ne() {
            return !0;
          }
          function Re() {
            return !1;
          }
          function Pe(e, t, n, r, o, i) {
            var s, a;
            if ("object" == typeof t) {
              for (a in ("string" != typeof n && ((r = r || n), (n = void 0)),
              t))
                Pe(e, a, n, r, t[a], i);
              return e;
            }
            if (
              (null == r && null == o
                ? ((o = n), (r = n = void 0))
                : null == o &&
                  ("string" == typeof n
                    ? ((o = r), (r = void 0))
                    : ((o = r), (r = n), (n = void 0))),
              !1 === o)
            )
              o = Re;
            else if (!o) return e;
            return (
              1 === i &&
                ((s = o),
                (o = function (e) {
                  return C().off(e), s.apply(this, arguments);
                }),
                (o.guid = s.guid || (s.guid = C.guid++))),
              e.each(function () {
                C.event.add(this, t, o, r, n);
              })
            );
          }
          function $e(e, t, n) {
            n
              ? (oe.set(e, t, !1),
                C.event.add(e, t, {
                  namespace: !1,
                  handler: function (e) {
                    var n,
                      r = oe.get(this, t);
                    if (1 & e.isTrigger && this[t]) {
                      if (r)
                        (C.event.special[t] || {}).delegateType &&
                          e.stopPropagation();
                      else if (
                        ((r = o.call(arguments)),
                        oe.set(this, t, r),
                        this[t](),
                        (n = oe.get(this, t)),
                        oe.set(this, t, !1),
                        r !== n)
                      )
                        return (
                          e.stopImmediatePropagation(), e.preventDefault(), n
                        );
                    } else
                      r &&
                        (oe.set(
                          this,
                          t,
                          C.event.trigger(r[0], r.slice(1), this),
                        ),
                        e.stopPropagation(),
                        (e.isImmediatePropagationStopped = Ne));
                  },
                }))
              : void 0 === oe.get(e, t) && C.event.add(e, t, Ne);
          }
          (C.event = {
            global: {},
            add: function (e, t, n, r, o) {
              var i,
                s,
                a,
                u,
                c,
                l,
                d,
                p,
                f,
                h,
                g,
                m = oe.get(e);
              if (ne(e))
                for (
                  n.handler && ((n = (i = n).handler), (o = i.selector)),
                    o && C.find.matchesSelector(pe, o),
                    n.guid || (n.guid = C.guid++),
                    (u = m.events) || (u = m.events = Object.create(null)),
                    (s = m.handle) ||
                      (s = m.handle =
                        function (t) {
                          return void 0 !== C && C.event.triggered !== t.type
                            ? C.event.dispatch.apply(e, arguments)
                            : void 0;
                        }),
                    c = (t = (t || "").match(V) || [""]).length;
                  c--;

                )
                  (f = g = (a = je.exec(t[c]) || [])[1]),
                    (h = (a[2] || "").split(".").sort()),
                    f &&
                      ((d = C.event.special[f] || {}),
                      (f = (o ? d.delegateType : d.bindType) || f),
                      (d = C.event.special[f] || {}),
                      (l = C.extend(
                        {
                          type: f,
                          origType: g,
                          data: r,
                          handler: n,
                          guid: n.guid,
                          selector: o,
                          needsContext: o && C.expr.match.needsContext.test(o),
                          namespace: h.join("."),
                        },
                        i,
                      )),
                      (p = u[f]) ||
                        (((p = u[f] = []).delegateCount = 0),
                        (d.setup && !1 !== d.setup.call(e, r, h, s)) ||
                          (e.addEventListener && e.addEventListener(f, s))),
                      d.add &&
                        (d.add.call(e, l),
                        l.handler.guid || (l.handler.guid = n.guid)),
                      o ? p.splice(p.delegateCount++, 0, l) : p.push(l),
                      (C.event.global[f] = !0));
            },
            remove: function (e, t, n, r, o) {
              var i,
                s,
                a,
                u,
                c,
                l,
                d,
                p,
                f,
                h,
                g,
                m = oe.hasData(e) && oe.get(e);
              if (m && (u = m.events)) {
                for (c = (t = (t || "").match(V) || [""]).length; c--; )
                  if (
                    ((f = g = (a = je.exec(t[c]) || [])[1]),
                    (h = (a[2] || "").split(".").sort()),
                    f)
                  ) {
                    for (
                      d = C.event.special[f] || {},
                        p =
                          u[(f = (r ? d.delegateType : d.bindType) || f)] || [],
                        a =
                          a[2] &&
                          new RegExp(
                            "(^|\\.)" + h.join("\\.(?:.*\\.|)") + "(\\.|$)",
                          ),
                        s = i = p.length;
                      i--;

                    )
                      (l = p[i]),
                        (!o && g !== l.origType) ||
                          (n && n.guid !== l.guid) ||
                          (a && !a.test(l.namespace)) ||
                          (r &&
                            r !== l.selector &&
                            ("**" !== r || !l.selector)) ||
                          (p.splice(i, 1),
                          l.selector && p.delegateCount--,
                          d.remove && d.remove.call(e, l));
                    s &&
                      !p.length &&
                      ((d.teardown && !1 !== d.teardown.call(e, h, m.handle)) ||
                        C.removeEvent(e, f, m.handle),
                      delete u[f]);
                  } else for (f in u) C.event.remove(e, f + t[c], n, r, !0);
                C.isEmptyObject(u) && oe.remove(e, "handle events");
              }
            },
            dispatch: function (e) {
              var t,
                n,
                r,
                o,
                i,
                s,
                a = new Array(arguments.length),
                u = C.event.fix(e),
                c =
                  (oe.get(this, "events") || Object.create(null))[u.type] || [],
                l = C.event.special[u.type] || {};
              for (a[0] = u, t = 1; t < arguments.length; t++)
                a[t] = arguments[t];
              if (
                ((u.delegateTarget = this),
                !l.preDispatch || !1 !== l.preDispatch.call(this, u))
              ) {
                for (
                  s = C.event.handlers.call(this, u, c), t = 0;
                  (o = s[t++]) && !u.isPropagationStopped();

                )
                  for (
                    u.currentTarget = o.elem, n = 0;
                    (i = o.handlers[n++]) && !u.isImmediatePropagationStopped();

                  )
                    (u.rnamespace &&
                      !1 !== i.namespace &&
                      !u.rnamespace.test(i.namespace)) ||
                      ((u.handleObj = i),
                      (u.data = i.data),
                      void 0 !==
                        (r = (
                          (C.event.special[i.origType] || {}).handle ||
                          i.handler
                        ).apply(o.elem, a)) &&
                        !1 === (u.result = r) &&
                        (u.preventDefault(), u.stopPropagation()));
                return l.postDispatch && l.postDispatch.call(this, u), u.result;
              }
            },
            handlers: function (e, t) {
              var n,
                r,
                o,
                i,
                s,
                a = [],
                u = t.delegateCount,
                c = e.target;
              if (u && c.nodeType && !("click" === e.type && e.button >= 1))
                for (; c !== this; c = c.parentNode || this)
                  if (
                    1 === c.nodeType &&
                    ("click" !== e.type || !0 !== c.disabled)
                  ) {
                    for (i = [], s = {}, n = 0; n < u; n++)
                      void 0 === s[(o = (r = t[n]).selector + " ")] &&
                        (s[o] = r.needsContext
                          ? C(o, this).index(c) > -1
                          : C.find(o, this, null, [c]).length),
                        s[o] && i.push(r);
                    i.length && a.push({ elem: c, handlers: i });
                  }
              return (
                (c = this),
                u < t.length && a.push({ elem: c, handlers: t.slice(u) }),
                a
              );
            },
            addProp: function (e, t) {
              Object.defineProperty(C.Event.prototype, e, {
                enumerable: !0,
                configurable: !0,
                get: h(t)
                  ? function () {
                      if (this.originalEvent) return t(this.originalEvent);
                    }
                  : function () {
                      if (this.originalEvent) return this.originalEvent[e];
                    },
                set: function (t) {
                  Object.defineProperty(this, e, {
                    enumerable: !0,
                    configurable: !0,
                    writable: !0,
                    value: t,
                  });
                },
              });
            },
            fix: function (e) {
              return e[C.expando] ? e : new C.Event(e);
            },
            special: {
              load: { noBubble: !0 },
              click: {
                setup: function (e) {
                  var t = this || e;
                  return (
                    Ce.test(t.type) &&
                      t.click &&
                      E(t, "input") &&
                      $e(t, "click", !0),
                    !1
                  );
                },
                trigger: function (e) {
                  var t = this || e;
                  return (
                    Ce.test(t.type) &&
                      t.click &&
                      E(t, "input") &&
                      $e(t, "click"),
                    !0
                  );
                },
                _default: function (e) {
                  var t = e.target;
                  return (
                    (Ce.test(t.type) &&
                      t.click &&
                      E(t, "input") &&
                      oe.get(t, "click")) ||
                    E(t, "a")
                  );
                },
              },
              beforeunload: {
                postDispatch: function (e) {
                  void 0 !== e.result &&
                    e.originalEvent &&
                    (e.originalEvent.returnValue = e.result);
                },
              },
            },
          }),
            (C.removeEvent = function (e, t, n) {
              e.removeEventListener && e.removeEventListener(t, n);
            }),
            (C.Event = function (e, t) {
              if (!(this instanceof C.Event)) return new C.Event(e, t);
              e && e.type
                ? ((this.originalEvent = e),
                  (this.type = e.type),
                  (this.isDefaultPrevented =
                    e.defaultPrevented ||
                    (void 0 === e.defaultPrevented && !1 === e.returnValue)
                      ? Ne
                      : Re),
                  (this.target =
                    e.target && 3 === e.target.nodeType
                      ? e.target.parentNode
                      : e.target),
                  (this.currentTarget = e.currentTarget),
                  (this.relatedTarget = e.relatedTarget))
                : (this.type = e),
                t && C.extend(this, t),
                (this.timeStamp = (e && e.timeStamp) || Date.now()),
                (this[C.expando] = !0);
            }),
            (C.Event.prototype = {
              constructor: C.Event,
              isDefaultPrevented: Re,
              isPropagationStopped: Re,
              isImmediatePropagationStopped: Re,
              isSimulated: !1,
              preventDefault: function () {
                var e = this.originalEvent;
                (this.isDefaultPrevented = Ne),
                  e && !this.isSimulated && e.preventDefault();
              },
              stopPropagation: function () {
                var e = this.originalEvent;
                (this.isPropagationStopped = Ne),
                  e && !this.isSimulated && e.stopPropagation();
              },
              stopImmediatePropagation: function () {
                var e = this.originalEvent;
                (this.isImmediatePropagationStopped = Ne),
                  e && !this.isSimulated && e.stopImmediatePropagation(),
                  this.stopPropagation();
              },
            }),
            C.each(
              {
                altKey: !0,
                bubbles: !0,
                cancelable: !0,
                changedTouches: !0,
                ctrlKey: !0,
                detail: !0,
                eventPhase: !0,
                metaKey: !0,
                pageX: !0,
                pageY: !0,
                shiftKey: !0,
                view: !0,
                char: !0,
                code: !0,
                charCode: !0,
                key: !0,
                keyCode: !0,
                button: !0,
                buttons: !0,
                clientX: !0,
                clientY: !0,
                offsetX: !0,
                offsetY: !0,
                pointerId: !0,
                pointerType: !0,
                screenX: !0,
                screenY: !0,
                targetTouches: !0,
                toElement: !0,
                touches: !0,
                which: !0,
              },
              C.event.addProp,
            ),
            C.each({ focus: "focusin", blur: "focusout" }, function (e, t) {
              function n(e) {
                if (m.documentMode) {
                  var n = oe.get(this, "handle"),
                    r = C.event.fix(e);
                  (r.type = "focusin" === e.type ? "focus" : "blur"),
                    (r.isSimulated = !0),
                    n(e),
                    r.target === r.currentTarget && n(r);
                } else C.event.simulate(t, e.target, C.event.fix(e));
              }
              (C.event.special[e] = {
                setup: function () {
                  var r;
                  if (($e(this, e, !0), !m.documentMode)) return !1;
                  (r = oe.get(this, t)) || this.addEventListener(t, n),
                    oe.set(this, t, (r || 0) + 1);
                },
                trigger: function () {
                  return $e(this, e), !0;
                },
                teardown: function () {
                  var e;
                  if (!m.documentMode) return !1;
                  (e = oe.get(this, t) - 1)
                    ? oe.set(this, t, e)
                    : (this.removeEventListener(t, n), oe.remove(this, t));
                },
                _default: function (t) {
                  return oe.get(t.target, e);
                },
                delegateType: t,
              }),
                (C.event.special[t] = {
                  setup: function () {
                    var r = this.ownerDocument || this.document || this,
                      o = m.documentMode ? this : r,
                      i = oe.get(o, t);
                    i ||
                      (m.documentMode
                        ? this.addEventListener(t, n)
                        : r.addEventListener(e, n, !0)),
                      oe.set(o, t, (i || 0) + 1);
                  },
                  teardown: function () {
                    var r = this.ownerDocument || this.document || this,
                      o = m.documentMode ? this : r,
                      i = oe.get(o, t) - 1;
                    i
                      ? oe.set(o, t, i)
                      : (m.documentMode
                          ? this.removeEventListener(t, n)
                          : r.removeEventListener(e, n, !0),
                        oe.remove(o, t));
                  },
                });
            }),
            C.each(
              {
                mouseenter: "mouseover",
                mouseleave: "mouseout",
                pointerenter: "pointerover",
                pointerleave: "pointerout",
              },
              function (e, t) {
                C.event.special[e] = {
                  delegateType: t,
                  bindType: t,
                  handle: function (e) {
                    var n,
                      r = e.relatedTarget,
                      o = e.handleObj;
                    return (
                      (r && (r === this || C.contains(this, r))) ||
                        ((e.type = o.origType),
                        (n = o.handler.apply(this, arguments)),
                        (e.type = t)),
                      n
                    );
                  },
                };
              },
            ),
            C.fn.extend({
              on: function (e, t, n, r) {
                return Pe(this, e, t, n, r);
              },
              one: function (e, t, n, r) {
                return Pe(this, e, t, n, r, 1);
              },
              off: function (e, t, n) {
                var r, o;
                if (e && e.preventDefault && e.handleObj)
                  return (
                    (r = e.handleObj),
                    C(e.delegateTarget).off(
                      r.namespace ? r.origType + "." + r.namespace : r.origType,
                      r.selector,
                      r.handler,
                    ),
                    this
                  );
                if ("object" == typeof e) {
                  for (o in e) this.off(o, t, e[o]);
                  return this;
                }
                return (
                  (!1 !== t && "function" != typeof t) ||
                    ((n = t), (t = void 0)),
                  !1 === n && (n = Re),
                  this.each(function () {
                    C.event.remove(this, e, n, t);
                  })
                );
              },
            });
          var _e = /<script|<style|<link/i,
            Me = /checked\s*(?:[^=]|=\s*.checked.)/i,
            Oe = /^\s*<!\[CDATA\[|\]\]>\s*$/g;
          function Le(e, t) {
            return (
              (E(e, "table") &&
                E(11 !== t.nodeType ? t : t.firstChild, "tr") &&
                C(e).children("tbody")[0]) ||
              e
            );
          }
          function qe(e) {
            return (
              (e.type = (null !== e.getAttribute("type")) + "/" + e.type), e
            );
          }
          function Fe(e) {
            return (
              "true/" === (e.type || "").slice(0, 5)
                ? (e.type = e.type.slice(5))
                : e.removeAttribute("type"),
              e
            );
          }
          function He(e, t) {
            var n, r, o, i, s, a;
            if (1 === t.nodeType) {
              if (oe.hasData(e) && (a = oe.get(e).events))
                for (o in (oe.remove(t, "handle events"), a))
                  for (n = 0, r = a[o].length; n < r; n++)
                    C.event.add(t, o, a[o][n]);
              ie.hasData(e) &&
                ((i = ie.access(e)), (s = C.extend({}, i)), ie.set(t, s));
            }
          }
          function Be(e, t) {
            var n = t.nodeName.toLowerCase();
            "input" === n && Ce.test(e.type)
              ? (t.checked = e.checked)
              : ("input" !== n && "textarea" !== n) ||
                (t.defaultValue = e.defaultValue);
          }
          function We(e, t, n, r) {
            t = i(t);
            var o,
              s,
              a,
              u,
              c,
              l,
              d = 0,
              p = e.length,
              g = p - 1,
              m = t[0],
              y = h(m);
            if (
              y ||
              (p > 1 && "string" == typeof m && !f.checkClone && Me.test(m))
            )
              return e.each(function (o) {
                var i = e.eq(o);
                y && (t[0] = m.call(this, o, i.html())), We(i, t, n, r);
              });
            if (
              p &&
              ((s = (o = De(t, e[0].ownerDocument, !1, e, r)).firstChild),
              1 === o.childNodes.length && (o = s),
              s || r)
            ) {
              for (u = (a = C.map(ke(o, "script"), qe)).length; d < p; d++)
                (c = o),
                  d !== g &&
                    ((c = C.clone(c, !0, !0)),
                    u && C.merge(a, ke(c, "script"))),
                  n.call(e[d], c, d);
              if (u)
                for (
                  l = a[a.length - 1].ownerDocument, C.map(a, Fe), d = 0;
                  d < u;
                  d++
                )
                  (c = a[d]),
                    Ee.test(c.type || "") &&
                      !oe.access(c, "globalEval") &&
                      C.contains(l, c) &&
                      (c.src && "module" !== (c.type || "").toLowerCase()
                        ? C._evalUrl &&
                          !c.noModule &&
                          C._evalUrl(
                            c.src,
                            { nonce: c.nonce || c.getAttribute("nonce") },
                            l,
                          )
                        : v(c.textContent.replace(Oe, ""), c, l));
            }
            return e;
          }
          function Ve(e, t, n) {
            for (
              var r, o = t ? C.filter(t, e) : e, i = 0;
              null != (r = o[i]);
              i++
            )
              n || 1 !== r.nodeType || C.cleanData(ke(r)),
                r.parentNode &&
                  (n && fe(r) && Ie(ke(r, "script")),
                  r.parentNode.removeChild(r));
            return e;
          }
          C.extend({
            htmlPrefilter: function (e) {
              return e;
            },
            clone: function (e, t, n) {
              var r,
                o,
                i,
                s,
                a = e.cloneNode(!0),
                u = fe(e);
              if (
                !(
                  f.noCloneChecked ||
                  (1 !== e.nodeType && 11 !== e.nodeType) ||
                  C.isXMLDoc(e)
                )
              )
                for (s = ke(a), r = 0, o = (i = ke(e)).length; r < o; r++)
                  Be(i[r], s[r]);
              if (t)
                if (n)
                  for (
                    i = i || ke(e), s = s || ke(a), r = 0, o = i.length;
                    r < o;
                    r++
                  )
                    He(i[r], s[r]);
                else He(e, a);
              return (
                (s = ke(a, "script")).length > 0 &&
                  Ie(s, !u && ke(e, "script")),
                a
              );
            },
            cleanData: function (e) {
              for (
                var t, n, r, o = C.event.special, i = 0;
                void 0 !== (n = e[i]);
                i++
              )
                if (ne(n)) {
                  if ((t = n[oe.expando])) {
                    if (t.events)
                      for (r in t.events)
                        o[r]
                          ? C.event.remove(n, r)
                          : C.removeEvent(n, r, t.handle);
                    n[oe.expando] = void 0;
                  }
                  n[ie.expando] && (n[ie.expando] = void 0);
                }
            },
          }),
            C.fn.extend({
              detach: function (e) {
                return Ve(this, e, !0);
              },
              remove: function (e) {
                return Ve(this, e);
              },
              text: function (e) {
                return J(
                  this,
                  function (e) {
                    return void 0 === e
                      ? C.text(this)
                      : this.empty().each(function () {
                          (1 !== this.nodeType &&
                            11 !== this.nodeType &&
                            9 !== this.nodeType) ||
                            (this.textContent = e);
                        });
                  },
                  null,
                  e,
                  arguments.length,
                );
              },
              append: function () {
                return We(this, arguments, function (e) {
                  (1 !== this.nodeType &&
                    11 !== this.nodeType &&
                    9 !== this.nodeType) ||
                    Le(this, e).appendChild(e);
                });
              },
              prepend: function () {
                return We(this, arguments, function (e) {
                  if (
                    1 === this.nodeType ||
                    11 === this.nodeType ||
                    9 === this.nodeType
                  ) {
                    var t = Le(this, e);
                    t.insertBefore(e, t.firstChild);
                  }
                });
              },
              before: function () {
                return We(this, arguments, function (e) {
                  this.parentNode && this.parentNode.insertBefore(e, this);
                });
              },
              after: function () {
                return We(this, arguments, function (e) {
                  this.parentNode &&
                    this.parentNode.insertBefore(e, this.nextSibling);
                });
              },
              empty: function () {
                for (var e, t = 0; null != (e = this[t]); t++)
                  1 === e.nodeType &&
                    (C.cleanData(ke(e, !1)), (e.textContent = ""));
                return this;
              },
              clone: function (e, t) {
                return (
                  (e = null != e && e),
                  (t = null == t ? e : t),
                  this.map(function () {
                    return C.clone(this, e, t);
                  })
                );
              },
              html: function (e) {
                return J(
                  this,
                  function (e) {
                    var t = this[0] || {},
                      n = 0,
                      r = this.length;
                    if (void 0 === e && 1 === t.nodeType) return t.innerHTML;
                    if (
                      "string" == typeof e &&
                      !_e.test(e) &&
                      !Se[(Te.exec(e) || ["", ""])[1].toLowerCase()]
                    ) {
                      e = C.htmlPrefilter(e);
                      try {
                        for (; n < r; n++)
                          1 === (t = this[n] || {}).nodeType &&
                            (C.cleanData(ke(t, !1)), (t.innerHTML = e));
                        t = 0;
                      } catch (o) {}
                    }
                    t && this.empty().append(e);
                  },
                  null,
                  e,
                  arguments.length,
                );
              },
              replaceWith: function () {
                var e = [];
                return We(
                  this,
                  arguments,
                  function (t) {
                    var n = this.parentNode;
                    C.inArray(this, e) < 0 &&
                      (C.cleanData(ke(this)), n && n.replaceChild(t, this));
                  },
                  e,
                );
              },
            }),
            C.each(
              {
                appendTo: "append",
                prependTo: "prepend",
                insertBefore: "before",
                insertAfter: "after",
                replaceAll: "replaceWith",
              },
              function (e, t) {
                C.fn[e] = function (e) {
                  for (
                    var n, r = [], o = C(e), i = o.length - 1, a = 0;
                    a <= i;
                    a++
                  )
                    (n = a === i ? this : this.clone(!0)),
                      C(o[a])[t](n),
                      s.apply(r, n.get());
                  return this.pushStack(r);
                };
              },
            );
          var Ue = new RegExp("^(" + ce + ")(?!px)[a-z%]+$", "i"),
            ze = /^--/,
            Ge = function (t) {
              var n = t.ownerDocument.defaultView;
              return (n && n.opener) || (n = e), n.getComputedStyle(t);
            },
            Xe = function (e, t, n) {
              var r,
                o,
                i = {};
              for (o in t) (i[o] = e.style[o]), (e.style[o] = t[o]);
              for (o in ((r = n.call(e)), t)) e.style[o] = i[o];
              return r;
            },
            Qe = new RegExp(de.join("|"), "i");
          function Ye(e, t, n) {
            var r,
              o,
              i,
              s,
              a = ze.test(t),
              u = e.style;
            return (
              (n = n || Ge(e)) &&
                ((s = n.getPropertyValue(t) || n[t]),
                a && s && (s = s.replace(D, "$1") || void 0),
                "" !== s || fe(e) || (s = C.style(e, t)),
                !f.pixelBoxStyles() &&
                  Ue.test(s) &&
                  Qe.test(t) &&
                  ((r = u.width),
                  (o = u.minWidth),
                  (i = u.maxWidth),
                  (u.minWidth = u.maxWidth = u.width = s),
                  (s = n.width),
                  (u.width = r),
                  (u.minWidth = o),
                  (u.maxWidth = i))),
              void 0 !== s ? s + "" : s
            );
          }
          function Je(e, t) {
            return {
              get: function () {
                if (!e()) return (this.get = t).apply(this, arguments);
                delete this.get;
              },
            };
          }
          !(function () {
            function t() {
              if (l) {
                (c.style.cssText =
                  "position:absolute;left:-11111px;width:60px;margin-top:1px;padding:0;border:0"),
                  (l.style.cssText =
                    "position:relative;display:block;box-sizing:border-box;overflow:scroll;margin:auto;border:1px;padding:1px;width:60%;top:1%"),
                  pe.appendChild(c).appendChild(l);
                var t = e.getComputedStyle(l);
                (r = "1%" !== t.top),
                  (u = 12 === n(t.marginLeft)),
                  (l.style.right = "60%"),
                  (s = 36 === n(t.right)),
                  (o = 36 === n(t.width)),
                  (l.style.position = "absolute"),
                  (i = 12 === n(l.offsetWidth / 3)),
                  pe.removeChild(c),
                  (l = null);
              }
            }
            function n(e) {
              return Math.round(parseFloat(e));
            }
            var r,
              o,
              i,
              s,
              a,
              u,
              c = m.createElement("div"),
              l = m.createElement("div");
            l.style &&
              ((l.style.backgroundClip = "content-box"),
              (l.cloneNode(!0).style.backgroundClip = ""),
              (f.clearCloneStyle = "content-box" === l.style.backgroundClip),
              C.extend(f, {
                boxSizingReliable: function () {
                  return t(), o;
                },
                pixelBoxStyles: function () {
                  return t(), s;
                },
                pixelPosition: function () {
                  return t(), r;
                },
                reliableMarginLeft: function () {
                  return t(), u;
                },
                scrollboxSize: function () {
                  return t(), i;
                },
                reliableTrDimensions: function () {
                  var t, n, r, o;
                  return (
                    null == a &&
                      ((t = m.createElement("table")),
                      (n = m.createElement("tr")),
                      (r = m.createElement("div")),
                      (t.style.cssText =
                        "position:absolute;left:-11111px;border-collapse:separate"),
                      (n.style.cssText =
                        "box-sizing:content-box;border:1px solid"),
                      (n.style.height = "1px"),
                      (r.style.height = "9px"),
                      (r.style.display = "block"),
                      pe.appendChild(t).appendChild(n).appendChild(r),
                      (o = e.getComputedStyle(n)),
                      (a =
                        parseInt(o.height, 10) +
                          parseInt(o.borderTopWidth, 10) +
                          parseInt(o.borderBottomWidth, 10) ===
                        n.offsetHeight),
                      pe.removeChild(t)),
                    a
                  );
                },
              }));
          })();
          var Ke = ["Webkit", "Moz", "ms"],
            Ze = m.createElement("div").style,
            et = {};
          function tt(e) {
            var t = C.cssProps[e] || et[e];
            return (
              t ||
              (e in Ze
                ? e
                : (et[e] =
                    (function (e) {
                      for (
                        var t = e[0].toUpperCase() + e.slice(1), n = Ke.length;
                        n--;

                      )
                        if ((e = Ke[n] + t) in Ze) return e;
                    })(e) || e))
            );
          }
          var nt = /^(none|table(?!-c[ea]).+)/,
            rt = {
              position: "absolute",
              visibility: "hidden",
              display: "block",
            },
            ot = { letterSpacing: "0", fontWeight: "400" };
          function it(e, t, n) {
            var r = le.exec(t);
            return r ? Math.max(0, r[2] - (n || 0)) + (r[3] || "px") : t;
          }
          function st(e, t, n, r, o, i) {
            var s = "width" === t ? 1 : 0,
              a = 0,
              u = 0,
              c = 0;
            if (n === (r ? "border" : "content")) return 0;
            for (; s < 4; s += 2)
              "margin" === n && (c += C.css(e, n + de[s], !0, o)),
                r
                  ? ("content" === n &&
                      (u -= C.css(e, "padding" + de[s], !0, o)),
                    "margin" !== n &&
                      (u -= C.css(e, "border" + de[s] + "Width", !0, o)))
                  : ((u += C.css(e, "padding" + de[s], !0, o)),
                    "padding" !== n
                      ? (u += C.css(e, "border" + de[s] + "Width", !0, o))
                      : (a += C.css(e, "border" + de[s] + "Width", !0, o)));
            return (
              !r &&
                i >= 0 &&
                (u +=
                  Math.max(
                    0,
                    Math.ceil(
                      e["offset" + t[0].toUpperCase() + t.slice(1)] -
                        i -
                        u -
                        a -
                        0.5,
                    ),
                  ) || 0),
              u + c
            );
          }
          function at(e, t, n) {
            var r = Ge(e),
              o =
                (!f.boxSizingReliable() || n) &&
                "border-box" === C.css(e, "boxSizing", !1, r),
              i = o,
              s = Ye(e, t, r),
              a = "offset" + t[0].toUpperCase() + t.slice(1);
            if (Ue.test(s)) {
              if (!n) return s;
              s = "auto";
            }
            return (
              ((!f.boxSizingReliable() && o) ||
                (!f.reliableTrDimensions() && E(e, "tr")) ||
                "auto" === s ||
                (!parseFloat(s) && "inline" === C.css(e, "display", !1, r))) &&
                e.getClientRects().length &&
                ((o = "border-box" === C.css(e, "boxSizing", !1, r)),
                (i = a in e) && (s = e[a])),
              (s = parseFloat(s) || 0) +
                st(e, t, n || (o ? "border" : "content"), i, r, s) +
                "px"
            );
          }
          function ut(e, t, n, r, o) {
            return new ut.prototype.init(e, t, n, r, o);
          }
          C.extend({
            cssHooks: {
              opacity: {
                get: function (e, t) {
                  if (t) {
                    var n = Ye(e, "opacity");
                    return "" === n ? "1" : n;
                  }
                },
              },
            },
            cssNumber: {
              animationIterationCount: !0,
              aspectRatio: !0,
              borderImageSlice: !0,
              columnCount: !0,
              flexGrow: !0,
              flexShrink: !0,
              fontWeight: !0,
              gridArea: !0,
              gridColumn: !0,
              gridColumnEnd: !0,
              gridColumnStart: !0,
              gridRow: !0,
              gridRowEnd: !0,
              gridRowStart: !0,
              lineHeight: !0,
              opacity: !0,
              order: !0,
              orphans: !0,
              scale: !0,
              widows: !0,
              zIndex: !0,
              zoom: !0,
              fillOpacity: !0,
              floodOpacity: !0,
              stopOpacity: !0,
              strokeMiterlimit: !0,
              strokeOpacity: !0,
            },
            cssProps: {},
            style: function (e, t, n, r) {
              if (e && 3 !== e.nodeType && 8 !== e.nodeType && e.style) {
                var o,
                  i,
                  s,
                  a = te(t),
                  u = ze.test(t),
                  c = e.style;
                if (
                  (u || (t = tt(a)),
                  (s = C.cssHooks[t] || C.cssHooks[a]),
                  void 0 === n)
                )
                  return s && "get" in s && void 0 !== (o = s.get(e, !1, r))
                    ? o
                    : c[t];
                "string" == (i = typeof n) &&
                  (o = le.exec(n)) &&
                  o[1] &&
                  ((n = me(e, t, o)), (i = "number")),
                  null != n &&
                    n == n &&
                    ("number" !== i ||
                      u ||
                      (n += (o && o[3]) || (C.cssNumber[a] ? "" : "px")),
                    f.clearCloneStyle ||
                      "" !== n ||
                      0 !== t.indexOf("background") ||
                      (c[t] = "inherit"),
                    (s && "set" in s && void 0 === (n = s.set(e, n, r))) ||
                      (u ? c.setProperty(t, n) : (c[t] = n)));
              }
            },
            css: function (e, t, n, r) {
              var o,
                i,
                s,
                a = te(t);
              return (
                ze.test(t) || (t = tt(a)),
                (s = C.cssHooks[t] || C.cssHooks[a]) &&
                  "get" in s &&
                  (o = s.get(e, !0, n)),
                void 0 === o && (o = Ye(e, t, r)),
                "normal" === o && t in ot && (o = ot[t]),
                "" === n || n
                  ? ((i = parseFloat(o)), !0 === n || isFinite(i) ? i || 0 : o)
                  : o
              );
            },
          }),
            C.each(["height", "width"], function (e, t) {
              C.cssHooks[t] = {
                get: function (e, n, r) {
                  if (n)
                    return !nt.test(C.css(e, "display")) ||
                      (e.getClientRects().length &&
                        e.getBoundingClientRect().width)
                      ? at(e, t, r)
                      : Xe(e, rt, function () {
                          return at(e, t, r);
                        });
                },
                set: function (e, n, r) {
                  var o,
                    i = Ge(e),
                    s = !f.scrollboxSize() && "absolute" === i.position,
                    a =
                      (s || r) && "border-box" === C.css(e, "boxSizing", !1, i),
                    u = r ? st(e, t, r, a, i) : 0;
                  return (
                    a &&
                      s &&
                      (u -= Math.ceil(
                        e["offset" + t[0].toUpperCase() + t.slice(1)] -
                          parseFloat(i[t]) -
                          st(e, t, "border", !1, i) -
                          0.5,
                      )),
                    u &&
                      (o = le.exec(n)) &&
                      "px" !== (o[3] || "px") &&
                      ((e.style[t] = n), (n = C.css(e, t))),
                    it(0, n, u)
                  );
                },
              };
            }),
            (C.cssHooks.marginLeft = Je(f.reliableMarginLeft, function (e, t) {
              if (t)
                return (
                  (parseFloat(Ye(e, "marginLeft")) ||
                    e.getBoundingClientRect().left -
                      Xe(e, { marginLeft: 0 }, function () {
                        return e.getBoundingClientRect().left;
                      })) + "px"
                );
            })),
            C.each(
              { margin: "", padding: "", border: "Width" },
              function (e, t) {
                (C.cssHooks[e + t] = {
                  expand: function (n) {
                    for (
                      var r = 0,
                        o = {},
                        i = "string" == typeof n ? n.split(" ") : [n];
                      r < 4;
                      r++
                    )
                      o[e + de[r] + t] = i[r] || i[r - 2] || i[0];
                    return o;
                  },
                }),
                  "margin" !== e && (C.cssHooks[e + t].set = it);
              },
            ),
            C.fn.extend({
              css: function (e, t) {
                return J(
                  this,
                  function (e, t, n) {
                    var r,
                      o,
                      i = {},
                      s = 0;
                    if (Array.isArray(t)) {
                      for (r = Ge(e), o = t.length; s < o; s++)
                        i[t[s]] = C.css(e, t[s], !1, r);
                      return i;
                    }
                    return void 0 !== n ? C.style(e, t, n) : C.css(e, t);
                  },
                  e,
                  t,
                  arguments.length > 1,
                );
              },
            }),
            (C.Tween = ut),
            (ut.prototype = {
              constructor: ut,
              init: function (e, t, n, r, o, i) {
                (this.elem = e),
                  (this.prop = n),
                  (this.easing = o || C.easing._default),
                  (this.options = t),
                  (this.start = this.now = this.cur()),
                  (this.end = r),
                  (this.unit = i || (C.cssNumber[n] ? "" : "px"));
              },
              cur: function () {
                var e = ut.propHooks[this.prop];
                return e && e.get
                  ? e.get(this)
                  : ut.propHooks._default.get(this);
              },
              run: function (e) {
                var t,
                  n = ut.propHooks[this.prop];
                return (
                  this.options.duration
                    ? (this.pos = t =
                        C.easing[this.easing](
                          e,
                          this.options.duration * e,
                          0,
                          1,
                          this.options.duration,
                        ))
                    : (this.pos = t = e),
                  (this.now = (this.end - this.start) * t + this.start),
                  this.options.step &&
                    this.options.step.call(this.elem, this.now, this),
                  n && n.set ? n.set(this) : ut.propHooks._default.set(this),
                  this
                );
              },
            }),
            (ut.prototype.init.prototype = ut.prototype),
            (ut.propHooks = {
              _default: {
                get: function (e) {
                  var t;
                  return 1 !== e.elem.nodeType ||
                    (null != e.elem[e.prop] && null == e.elem.style[e.prop])
                    ? e.elem[e.prop]
                    : (t = C.css(e.elem, e.prop, "")) && "auto" !== t
                      ? t
                      : 0;
                },
                set: function (e) {
                  C.fx.step[e.prop]
                    ? C.fx.step[e.prop](e)
                    : 1 !== e.elem.nodeType ||
                        (!C.cssHooks[e.prop] &&
                          null == e.elem.style[tt(e.prop)])
                      ? (e.elem[e.prop] = e.now)
                      : C.style(e.elem, e.prop, e.now + e.unit);
                },
              },
            }),
            (ut.propHooks.scrollTop = ut.propHooks.scrollLeft =
              {
                set: function (e) {
                  e.elem.nodeType &&
                    e.elem.parentNode &&
                    (e.elem[e.prop] = e.now);
                },
              }),
            (C.easing = {
              linear: function (e) {
                return e;
              },
              swing: function (e) {
                return 0.5 - Math.cos(e * Math.PI) / 2;
              },
              _default: "swing",
            }),
            (C.fx = ut.prototype.init),
            (C.fx.step = {});
          var ct,
            lt,
            dt = /^(?:toggle|show|hide)$/,
            pt = /queueHooks$/;
          function ft() {
            lt &&
              (!1 === m.hidden && e.requestAnimationFrame
                ? e.requestAnimationFrame(ft)
                : e.setTimeout(ft, C.fx.interval),
              C.fx.tick());
          }
          function ht() {
            return (
              e.setTimeout(function () {
                ct = void 0;
              }),
              (ct = Date.now())
            );
          }
          function gt(e, t) {
            var n,
              r = 0,
              o = { height: e };
            for (t = t ? 1 : 0; r < 4; r += 2 - t)
              o["margin" + (n = de[r])] = o["padding" + n] = e;
            return t && (o.opacity = o.width = e), o;
          }
          function mt(e, t, n) {
            for (
              var r,
                o = (yt.tweeners[t] || []).concat(yt.tweeners["*"]),
                i = 0,
                s = o.length;
              i < s;
              i++
            )
              if ((r = o[i].call(n, t, e))) return r;
          }
          function yt(e, t, n) {
            var r,
              o,
              i = 0,
              s = yt.prefilters.length,
              a = C.Deferred().always(function () {
                delete u.elem;
              }),
              u = function () {
                if (o) return !1;
                for (
                  var t = ct || ht(),
                    n = Math.max(0, c.startTime + c.duration - t),
                    r = 1 - (n / c.duration || 0),
                    i = 0,
                    s = c.tweens.length;
                  i < s;
                  i++
                )
                  c.tweens[i].run(r);
                return (
                  a.notifyWith(e, [c, r, n]),
                  r < 1 && s
                    ? n
                    : (s || a.notifyWith(e, [c, 1, 0]),
                      a.resolveWith(e, [c]),
                      !1)
                );
              },
              c = a.promise({
                elem: e,
                props: C.extend({}, t),
                opts: C.extend(
                  !0,
                  { specialEasing: {}, easing: C.easing._default },
                  n,
                ),
                originalProperties: t,
                originalOptions: n,
                startTime: ct || ht(),
                duration: n.duration,
                tweens: [],
                createTween: function (t, n) {
                  var r = C.Tween(
                    e,
                    c.opts,
                    t,
                    n,
                    c.opts.specialEasing[t] || c.opts.easing,
                  );
                  return c.tweens.push(r), r;
                },
                stop: function (t) {
                  var n = 0,
                    r = t ? c.tweens.length : 0;
                  if (o) return this;
                  for (o = !0; n < r; n++) c.tweens[n].run(1);
                  return (
                    t
                      ? (a.notifyWith(e, [c, 1, 0]), a.resolveWith(e, [c, t]))
                      : a.rejectWith(e, [c, t]),
                    this
                  );
                },
              }),
              l = c.props;
            for (
              (function (e, t) {
                var n, r, o, i, s;
                for (n in e)
                  if (
                    ((o = t[(r = te(n))]),
                    (i = e[n]),
                    Array.isArray(i) && ((o = i[1]), (i = e[n] = i[0])),
                    n !== r && ((e[r] = i), delete e[n]),
                    (s = C.cssHooks[r]) && ("expand" in s))
                  )
                    for (n in ((i = s.expand(i)), delete e[r], i))
                      (n in e) || ((e[n] = i[n]), (t[n] = o));
                  else t[r] = o;
              })(l, c.opts.specialEasing);
              i < s;
              i++
            )
              if ((r = yt.prefilters[i].call(c, e, l, c.opts)))
                return (
                  h(r.stop) &&
                    (C._queueHooks(c.elem, c.opts.queue).stop = r.stop.bind(r)),
                  r
                );
            return (
              C.map(l, mt, c),
              h(c.opts.start) && c.opts.start.call(e, c),
              c
                .progress(c.opts.progress)
                .done(c.opts.done, c.opts.complete)
                .fail(c.opts.fail)
                .always(c.opts.always),
              C.fx.timer(
                C.extend(u, { elem: e, anim: c, queue: c.opts.queue }),
              ),
              c
            );
          }
          (C.Animation = C.extend(yt, {
            tweeners: {
              "*": [
                function (e, t) {
                  var n = this.createTween(e, t);
                  return me(n.elem, e, le.exec(t), n), n;
                },
              ],
            },
            tweener: function (e, t) {
              h(e) ? ((t = e), (e = ["*"])) : (e = e.match(V));
              for (var n, r = 0, o = e.length; r < o; r++)
                (n = e[r]),
                  (yt.tweeners[n] = yt.tweeners[n] || []),
                  yt.tweeners[n].unshift(t);
            },
            prefilters: [
              function (e, t, n) {
                var r,
                  o,
                  i,
                  s,
                  a,
                  u,
                  c,
                  l,
                  d = "width" in t || "height" in t,
                  p = this,
                  f = {},
                  h = e.style,
                  g = e.nodeType && ge(e),
                  m = oe.get(e, "fxshow");
                for (r in (n.queue ||
                  (null == (s = C._queueHooks(e, "fx")).unqueued &&
                    ((s.unqueued = 0),
                    (a = s.empty.fire),
                    (s.empty.fire = function () {
                      s.unqueued || a();
                    })),
                  s.unqueued++,
                  p.always(function () {
                    p.always(function () {
                      s.unqueued--, C.queue(e, "fx").length || s.empty.fire();
                    });
                  })),
                t))
                  if (((o = t[r]), dt.test(o))) {
                    if (
                      (delete t[r],
                      (i = i || "toggle" === o),
                      o === (g ? "hide" : "show"))
                    ) {
                      if ("show" !== o || !m || void 0 === m[r]) continue;
                      g = !0;
                    }
                    f[r] = (m && m[r]) || C.style(e, r);
                  }
                if ((u = !C.isEmptyObject(t)) || !C.isEmptyObject(f))
                  for (r in (d &&
                    1 === e.nodeType &&
                    ((n.overflow = [h.overflow, h.overflowX, h.overflowY]),
                    null == (c = m && m.display) && (c = oe.get(e, "display")),
                    "none" === (l = C.css(e, "display")) &&
                      (c
                        ? (l = c)
                        : (xe([e], !0),
                          (c = e.style.display || c),
                          (l = C.css(e, "display")),
                          xe([e]))),
                    ("inline" === l || ("inline-block" === l && null != c)) &&
                      "none" === C.css(e, "float") &&
                      (u ||
                        (p.done(function () {
                          h.display = c;
                        }),
                        null == c &&
                          ((l = h.display), (c = "none" === l ? "" : l))),
                      (h.display = "inline-block"))),
                  n.overflow &&
                    ((h.overflow = "hidden"),
                    p.always(function () {
                      (h.overflow = n.overflow[0]),
                        (h.overflowX = n.overflow[1]),
                        (h.overflowY = n.overflow[2]);
                    })),
                  (u = !1),
                  f))
                    u ||
                      (m
                        ? "hidden" in m && (g = m.hidden)
                        : (m = oe.access(e, "fxshow", { display: c })),
                      i && (m.hidden = !g),
                      g && xe([e], !0),
                      p.done(function () {
                        for (r in (g || xe([e]), oe.remove(e, "fxshow"), f))
                          C.style(e, r, f[r]);
                      })),
                      (u = mt(g ? m[r] : 0, r, p)),
                      r in m ||
                        ((m[r] = u.start),
                        g && ((u.end = u.start), (u.start = 0)));
              },
            ],
            prefilter: function (e, t) {
              t ? yt.prefilters.unshift(e) : yt.prefilters.push(e);
            },
          })),
            (C.speed = function (e, t, n) {
              var r =
                e && "object" == typeof e
                  ? C.extend({}, e)
                  : {
                      complete: n || (!n && t) || (h(e) && e),
                      duration: e,
                      easing: (n && t) || (t && !h(t) && t),
                    };
              return (
                C.fx.off
                  ? (r.duration = 0)
                  : "number" != typeof r.duration &&
                    (r.duration in C.fx.speeds
                      ? (r.duration = C.fx.speeds[r.duration])
                      : (r.duration = C.fx.speeds._default)),
                (null != r.queue && !0 !== r.queue) || (r.queue = "fx"),
                (r.old = r.complete),
                (r.complete = function () {
                  h(r.old) && r.old.call(this),
                    r.queue && C.dequeue(this, r.queue);
                }),
                r
              );
            }),
            C.fn.extend({
              fadeTo: function (e, t, n, r) {
                return this.filter(ge)
                  .css("opacity", 0)
                  .show()
                  .end()
                  .animate({ opacity: t }, e, n, r);
              },
              animate: function (e, t, n, r) {
                var o = C.isEmptyObject(e),
                  i = C.speed(t, n, r),
                  s = function () {
                    var t = yt(this, C.extend({}, e), i);
                    (o || oe.get(this, "finish")) && t.stop(!0);
                  };
                return (
                  (s.finish = s),
                  o || !1 === i.queue ? this.each(s) : this.queue(i.queue, s)
                );
              },
              stop: function (e, t, n) {
                var r = function (e) {
                  var t = e.stop;
                  delete e.stop, t(n);
                };
                return (
                  "string" != typeof e && ((n = t), (t = e), (e = void 0)),
                  t && this.queue(e || "fx", []),
                  this.each(function () {
                    var t = !0,
                      o = null != e && e + "queueHooks",
                      i = C.timers,
                      s = oe.get(this);
                    if (o) s[o] && s[o].stop && r(s[o]);
                    else
                      for (o in s) s[o] && s[o].stop && pt.test(o) && r(s[o]);
                    for (o = i.length; o--; )
                      i[o].elem !== this ||
                        (null != e && i[o].queue !== e) ||
                        (i[o].anim.stop(n), (t = !1), i.splice(o, 1));
                    (!t && n) || C.dequeue(this, e);
                  })
                );
              },
              finish: function (e) {
                return (
                  !1 !== e && (e = e || "fx"),
                  this.each(function () {
                    var t,
                      n = oe.get(this),
                      r = n[e + "queue"],
                      o = n[e + "queueHooks"],
                      i = C.timers,
                      s = r ? r.length : 0;
                    for (
                      n.finish = !0,
                        C.queue(this, e, []),
                        o && o.stop && o.stop.call(this, !0),
                        t = i.length;
                      t--;

                    )
                      i[t].elem === this &&
                        i[t].queue === e &&
                        (i[t].anim.stop(!0), i.splice(t, 1));
                    for (t = 0; t < s; t++)
                      r[t] && r[t].finish && r[t].finish.call(this);
                    delete n.finish;
                  })
                );
              },
            }),
            C.each(["toggle", "show", "hide"], function (e, t) {
              var n = C.fn[t];
              C.fn[t] = function (e, r, o) {
                return null == e || "boolean" == typeof e
                  ? n.apply(this, arguments)
                  : this.animate(gt(t, !0), e, r, o);
              };
            }),
            C.each(
              {
                slideDown: gt("show"),
                slideUp: gt("hide"),
                slideToggle: gt("toggle"),
                fadeIn: { opacity: "show" },
                fadeOut: { opacity: "hide" },
                fadeToggle: { opacity: "toggle" },
              },
              function (e, t) {
                C.fn[e] = function (e, n, r) {
                  return this.animate(t, e, n, r);
                };
              },
            ),
            (C.timers = []),
            (C.fx.tick = function () {
              var e,
                t = 0,
                n = C.timers;
              for (ct = Date.now(); t < n.length; t++)
                (e = n[t])() || n[t] !== e || n.splice(t--, 1);
              n.length || C.fx.stop(), (ct = void 0);
            }),
            (C.fx.timer = function (e) {
              C.timers.push(e), C.fx.start();
            }),
            (C.fx.interval = 13),
            (C.fx.start = function () {
              lt || ((lt = !0), ft());
            }),
            (C.fx.stop = function () {
              lt = null;
            }),
            (C.fx.speeds = { slow: 600, fast: 200, _default: 400 }),
            (C.fn.delay = function (t, n) {
              return (
                (t = (C.fx && C.fx.speeds[t]) || t),
                (n = n || "fx"),
                this.queue(n, function (n, r) {
                  var o = e.setTimeout(n, t);
                  r.stop = function () {
                    e.clearTimeout(o);
                  };
                })
              );
            }),
            (function () {
              var e = m.createElement("input"),
                t = m
                  .createElement("select")
                  .appendChild(m.createElement("option"));
              (e.type = "checkbox"),
                (f.checkOn = "" !== e.value),
                (f.optSelected = t.selected),
                ((e = m.createElement("input")).value = "t"),
                (e.type = "radio"),
                (f.radioValue = "t" === e.value);
            })();
          var vt,
            xt = C.expr.attrHandle;
          C.fn.extend({
            attr: function (e, t) {
              return J(this, C.attr, e, t, arguments.length > 1);
            },
            removeAttr: function (e) {
              return this.each(function () {
                C.removeAttr(this, e);
              });
            },
          }),
            C.extend({
              attr: function (e, t, n) {
                var r,
                  o,
                  i = e.nodeType;
                if (3 !== i && 8 !== i && 2 !== i)
                  return void 0 === e.getAttribute
                    ? C.prop(e, t, n)
                    : ((1 === i && C.isXMLDoc(e)) ||
                        (o =
                          C.attrHooks[t.toLowerCase()] ||
                          (C.expr.match.bool.test(t) ? vt : void 0)),
                      void 0 !== n
                        ? null === n
                          ? void C.removeAttr(e, t)
                          : o && "set" in o && void 0 !== (r = o.set(e, n, t))
                            ? r
                            : (e.setAttribute(t, n + ""), n)
                        : o && "get" in o && null !== (r = o.get(e, t))
                          ? r
                          : null == (r = C.find.attr(e, t))
                            ? void 0
                            : r);
              },
              attrHooks: {
                type: {
                  set: function (e, t) {
                    if (!f.radioValue && "radio" === t && E(e, "input")) {
                      var n = e.value;
                      return e.setAttribute("type", t), n && (e.value = n), t;
                    }
                  },
                },
              },
              removeAttr: function (e, t) {
                var n,
                  r = 0,
                  o = t && t.match(V);
                if (o && 1 === e.nodeType)
                  for (; (n = o[r++]); ) e.removeAttribute(n);
              },
            }),
            (vt = {
              set: function (e, t, n) {
                return !1 === t ? C.removeAttr(e, n) : e.setAttribute(n, n), n;
              },
            }),
            C.each(C.expr.match.bool.source.match(/\w+/g), function (e, t) {
              var n = xt[t] || C.find.attr;
              xt[t] = function (e, t, r) {
                var o,
                  i,
                  s = t.toLowerCase();
                return (
                  r ||
                    ((i = xt[s]),
                    (xt[s] = o),
                    (o = null != n(e, t, r) ? s : null),
                    (xt[s] = i)),
                  o
                );
              };
            });
          var wt = /^(?:input|select|textarea|button)$/i,
            bt = /^(?:a|area)$/i;
          function Ct(e) {
            return (e.match(V) || []).join(" ");
          }
          function Tt(e) {
            return (e.getAttribute && e.getAttribute("class")) || "";
          }
          function Et(e) {
            return Array.isArray(e)
              ? e
              : ("string" == typeof e && e.match(V)) || [];
          }
          C.fn.extend({
            prop: function (e, t) {
              return J(this, C.prop, e, t, arguments.length > 1);
            },
            removeProp: function (e) {
              return this.each(function () {
                delete this[C.propFix[e] || e];
              });
            },
          }),
            C.extend({
              prop: function (e, t, n) {
                var r,
                  o,
                  i = e.nodeType;
                if (3 !== i && 8 !== i && 2 !== i)
                  return (
                    (1 === i && C.isXMLDoc(e)) ||
                      ((t = C.propFix[t] || t), (o = C.propHooks[t])),
                    void 0 !== n
                      ? o && "set" in o && void 0 !== (r = o.set(e, n, t))
                        ? r
                        : (e[t] = n)
                      : o && "get" in o && null !== (r = o.get(e, t))
                        ? r
                        : e[t]
                  );
              },
              propHooks: {
                tabIndex: {
                  get: function (e) {
                    var t = C.find.attr(e, "tabindex");
                    return t
                      ? parseInt(t, 10)
                      : wt.test(e.nodeName) || (bt.test(e.nodeName) && e.href)
                        ? 0
                        : -1;
                  },
                },
              },
              propFix: { for: "htmlFor", class: "className" },
            }),
            f.optSelected ||
              (C.propHooks.selected = {
                get: function (e) {
                  var t = e.parentNode;
                  return t && t.parentNode && t.parentNode.selectedIndex, null;
                },
                set: function (e) {
                  var t = e.parentNode;
                  t &&
                    (t.selectedIndex,
                    t.parentNode && t.parentNode.selectedIndex);
                },
              }),
            C.each(
              [
                "tabIndex",
                "readOnly",
                "maxLength",
                "cellSpacing",
                "cellPadding",
                "rowSpan",
                "colSpan",
                "useMap",
                "frameBorder",
                "contentEditable",
              ],
              function () {
                C.propFix[this.toLowerCase()] = this;
              },
            ),
            C.fn.extend({
              addClass: function (e) {
                var t, n, r, o, i, s;
                return h(e)
                  ? this.each(function (t) {
                      C(this).addClass(e.call(this, t, Tt(this)));
                    })
                  : (t = Et(e)).length
                    ? this.each(function () {
                        if (
                          ((r = Tt(this)),
                          (n = 1 === this.nodeType && " " + Ct(r) + " "))
                        ) {
                          for (i = 0; i < t.length; i++)
                            (o = t[i]),
                              n.indexOf(" " + o + " ") < 0 && (n += o + " ");
                          (s = Ct(n)), r !== s && this.setAttribute("class", s);
                        }
                      })
                    : this;
              },
              removeClass: function (e) {
                var t, n, r, o, i, s;
                return h(e)
                  ? this.each(function (t) {
                      C(this).removeClass(e.call(this, t, Tt(this)));
                    })
                  : arguments.length
                    ? (t = Et(e)).length
                      ? this.each(function () {
                          if (
                            ((r = Tt(this)),
                            (n = 1 === this.nodeType && " " + Ct(r) + " "))
                          ) {
                            for (i = 0; i < t.length; i++)
                              for (o = t[i]; n.indexOf(" " + o + " ") > -1; )
                                n = n.replace(" " + o + " ", " ");
                            (s = Ct(n)),
                              r !== s && this.setAttribute("class", s);
                          }
                        })
                      : this
                    : this.attr("class", "");
              },
              toggleClass: function (e, t) {
                var n,
                  r,
                  o,
                  i,
                  s = typeof e,
                  a = "string" === s || Array.isArray(e);
                return h(e)
                  ? this.each(function (n) {
                      C(this).toggleClass(e.call(this, n, Tt(this), t), t);
                    })
                  : "boolean" == typeof t && a
                    ? t
                      ? this.addClass(e)
                      : this.removeClass(e)
                    : ((n = Et(e)),
                      this.each(function () {
                        if (a)
                          for (i = C(this), o = 0; o < n.length; o++)
                            (r = n[o]),
                              i.hasClass(r) ? i.removeClass(r) : i.addClass(r);
                        else
                          (void 0 !== e && "boolean" !== s) ||
                            ((r = Tt(this)) && oe.set(this, "__className__", r),
                            this.setAttribute &&
                              this.setAttribute(
                                "class",
                                r || !1 === e
                                  ? ""
                                  : oe.get(this, "__className__") || "",
                              ));
                      }));
              },
              hasClass: function (e) {
                var t,
                  n,
                  r = 0;
                for (t = " " + e + " "; (n = this[r++]); )
                  if (
                    1 === n.nodeType &&
                    (" " + Ct(Tt(n)) + " ").indexOf(t) > -1
                  )
                    return !0;
                return !1;
              },
            });
          var St = /\r/g;
          C.fn.extend({
            val: function (e) {
              var t,
                n,
                r,
                o = this[0];
              return arguments.length
                ? ((r = h(e)),
                  this.each(function (n) {
                    var o;
                    1 === this.nodeType &&
                      (null == (o = r ? e.call(this, n, C(this).val()) : e)
                        ? (o = "")
                        : "number" == typeof o
                          ? (o += "")
                          : Array.isArray(o) &&
                            (o = C.map(o, function (e) {
                              return null == e ? "" : e + "";
                            })),
                      ((t =
                        C.valHooks[this.type] ||
                        C.valHooks[this.nodeName.toLowerCase()]) &&
                        "set" in t &&
                        void 0 !== t.set(this, o, "value")) ||
                        (this.value = o));
                  }))
                : o
                  ? (t =
                      C.valHooks[o.type] ||
                      C.valHooks[o.nodeName.toLowerCase()]) &&
                    "get" in t &&
                    void 0 !== (n = t.get(o, "value"))
                    ? n
                    : "string" == typeof (n = o.value)
                      ? n.replace(St, "")
                      : null == n
                        ? ""
                        : n
                  : void 0;
            },
          }),
            C.extend({
              valHooks: {
                option: {
                  get: function (e) {
                    var t = C.find.attr(e, "value");
                    return null != t ? t : Ct(C.text(e));
                  },
                },
                select: {
                  get: function (e) {
                    var t,
                      n,
                      r,
                      o = e.options,
                      i = e.selectedIndex,
                      s = "select-one" === e.type,
                      a = s ? null : [],
                      u = s ? i + 1 : o.length;
                    for (r = i < 0 ? u : s ? i : 0; r < u; r++)
                      if (
                        ((n = o[r]).selected || r === i) &&
                        !n.disabled &&
                        (!n.parentNode.disabled || !E(n.parentNode, "optgroup"))
                      ) {
                        if (((t = C(n).val()), s)) return t;
                        a.push(t);
                      }
                    return a;
                  },
                  set: function (e, t) {
                    for (
                      var n, r, o = e.options, i = C.makeArray(t), s = o.length;
                      s--;

                    )
                      ((r = o[s]).selected =
                        C.inArray(C.valHooks.option.get(r), i) > -1) &&
                        (n = !0);
                    return n || (e.selectedIndex = -1), i;
                  },
                },
              },
            }),
            C.each(["radio", "checkbox"], function () {
              (C.valHooks[this] = {
                set: function (e, t) {
                  if (Array.isArray(t))
                    return (e.checked = C.inArray(C(e).val(), t) > -1);
                },
              }),
                f.checkOn ||
                  (C.valHooks[this].get = function (e) {
                    return null === e.getAttribute("value") ? "on" : e.value;
                  });
            });
          var kt = e.location,
            It = { guid: Date.now() },
            At = /\?/;
          C.parseXML = function (t) {
            var n, r;
            if (!t || "string" != typeof t) return null;
            try {
              n = new e.DOMParser().parseFromString(t, "text/xml");
            } catch (o) {}
            return (
              (r = n && n.getElementsByTagName("parsererror")[0]),
              (n && !r) ||
                C.error(
                  "Invalid XML: " +
                    (r
                      ? C.map(r.childNodes, function (e) {
                          return e.textContent;
                        }).join("\n")
                      : t),
                ),
              n
            );
          };
          var Dt = /^(?:focusinfocus|focusoutblur)$/,
            jt = function (e) {
              e.stopPropagation();
            };
          C.extend(C.event, {
            trigger: function (t, n, r, o) {
              var i,
                s,
                a,
                u,
                c,
                d,
                p,
                f,
                y = [r || m],
                v = l.call(t, "type") ? t.type : t,
                x = l.call(t, "namespace") ? t.namespace.split(".") : [];
              if (
                ((s = f = a = r = r || m),
                3 !== r.nodeType &&
                  8 !== r.nodeType &&
                  !Dt.test(v + C.event.triggered) &&
                  (v.indexOf(".") > -1 &&
                    ((x = v.split(".")), (v = x.shift()), x.sort()),
                  (c = v.indexOf(":") < 0 && "on" + v),
                  ((t = t[C.expando]
                    ? t
                    : new C.Event(v, "object" == typeof t && t)).isTrigger = o
                    ? 2
                    : 3),
                  (t.namespace = x.join(".")),
                  (t.rnamespace = t.namespace
                    ? new RegExp(
                        "(^|\\.)" + x.join("\\.(?:.*\\.|)") + "(\\.|$)",
                      )
                    : null),
                  (t.result = void 0),
                  t.target || (t.target = r),
                  (n = null == n ? [t] : C.makeArray(n, [t])),
                  (p = C.event.special[v] || {}),
                  o || !p.trigger || !1 !== p.trigger.apply(r, n)))
              ) {
                if (!o && !p.noBubble && !g(r)) {
                  for (
                    u = p.delegateType || v,
                      Dt.test(u + v) || (s = s.parentNode);
                    s;
                    s = s.parentNode
                  )
                    y.push(s), (a = s);
                  a === (r.ownerDocument || m) &&
                    y.push(a.defaultView || a.parentWindow || e);
                }
                for (i = 0; (s = y[i++]) && !t.isPropagationStopped(); )
                  (f = s),
                    (t.type = i > 1 ? u : p.bindType || v),
                    (d =
                      (oe.get(s, "events") || Object.create(null))[t.type] &&
                      oe.get(s, "handle")) && d.apply(s, n),
                    (d = c && s[c]) &&
                      d.apply &&
                      ne(s) &&
                      ((t.result = d.apply(s, n)),
                      !1 === t.result && t.preventDefault());
                return (
                  (t.type = v),
                  o ||
                    t.isDefaultPrevented() ||
                    (p._default && !1 !== p._default.apply(y.pop(), n)) ||
                    !ne(r) ||
                    (c &&
                      h(r[v]) &&
                      !g(r) &&
                      ((a = r[c]) && (r[c] = null),
                      (C.event.triggered = v),
                      t.isPropagationStopped() && f.addEventListener(v, jt),
                      r[v](),
                      t.isPropagationStopped() && f.removeEventListener(v, jt),
                      (C.event.triggered = void 0),
                      a && (r[c] = a))),
                  t.result
                );
              }
            },
            simulate: function (e, t, n) {
              var r = C.extend(new C.Event(), n, { type: e, isSimulated: !0 });
              C.event.trigger(r, null, t);
            },
          }),
            C.fn.extend({
              trigger: function (e, t) {
                return this.each(function () {
                  C.event.trigger(e, t, this);
                });
              },
              triggerHandler: function (e, t) {
                var n = this[0];
                if (n) return C.event.trigger(e, t, n, !0);
              },
            });
          var Nt = /\[\]$/,
            Rt = /\r?\n/g,
            Pt = /^(?:submit|button|image|reset|file)$/i,
            $t = /^(?:input|select|textarea|keygen)/i;
          function _t(e, t, n, r) {
            var o;
            if (Array.isArray(t))
              C.each(t, function (t, o) {
                n || Nt.test(e)
                  ? r(e, o)
                  : _t(
                      e +
                        "[" +
                        ("object" == typeof o && null != o ? t : "") +
                        "]",
                      o,
                      n,
                      r,
                    );
              });
            else if (n || "object" !== x(t)) r(e, t);
            else for (o in t) _t(e + "[" + o + "]", t[o], n, r);
          }
          (C.param = function (e, t) {
            var n,
              r = [],
              o = function (e, t) {
                var n = h(t) ? t() : t;
                r[r.length] =
                  encodeURIComponent(e) +
                  "=" +
                  encodeURIComponent(null == n ? "" : n);
              };
            if (null == e) return "";
            if (Array.isArray(e) || (e.jquery && !C.isPlainObject(e)))
              C.each(e, function () {
                o(this.name, this.value);
              });
            else for (n in e) _t(n, e[n], t, o);
            return r.join("&");
          }),
            C.fn.extend({
              serialize: function () {
                return C.param(this.serializeArray());
              },
              serializeArray: function () {
                return this.map(function () {
                  var e = C.prop(this, "elements");
                  return e ? C.makeArray(e) : this;
                })
                  .filter(function () {
                    var e = this.type;
                    return (
                      this.name &&
                      !C(this).is(":disabled") &&
                      $t.test(this.nodeName) &&
                      !Pt.test(e) &&
                      (this.checked || !Ce.test(e))
                    );
                  })
                  .map(function (e, t) {
                    var n = C(this).val();
                    return null == n
                      ? null
                      : Array.isArray(n)
                        ? C.map(n, function (e) {
                            return {
                              name: t.name,
                              value: e.replace(Rt, "\r\n"),
                            };
                          })
                        : { name: t.name, value: n.replace(Rt, "\r\n") };
                  })
                  .get();
              },
            });
          var Mt = /%20/g,
            Ot = /#.*$/,
            Lt = /([?&])_=[^&]*/,
            qt = /^(.*?):[ \t]*([^\r\n]*)$/gm,
            Ft = /^(?:GET|HEAD)$/,
            Ht = /^\/\//,
            Bt = {},
            Wt = {},
            Vt = "*/".concat("*"),
            Ut = m.createElement("a");
          function zt(e) {
            return function (t, n) {
              "string" != typeof t && ((n = t), (t = "*"));
              var r,
                o = 0,
                i = t.toLowerCase().match(V) || [];
              if (h(n))
                for (; (r = i[o++]); )
                  "+" === r[0]
                    ? ((r = r.slice(1) || "*"), (e[r] = e[r] || []).unshift(n))
                    : (e[r] = e[r] || []).push(n);
            };
          }
          function Gt(e, t, n, r) {
            var o = {},
              i = e === Wt;
            function s(a) {
              var u;
              return (
                (o[a] = !0),
                C.each(e[a] || [], function (e, a) {
                  var c = a(t, n, r);
                  return "string" != typeof c || i || o[c]
                    ? i
                      ? !(u = c)
                      : void 0
                    : (t.dataTypes.unshift(c), s(c), !1);
                }),
                u
              );
            }
            return s(t.dataTypes[0]) || (!o["*"] && s("*"));
          }
          function Xt(e, t) {
            var n,
              r,
              o = C.ajaxSettings.flatOptions || {};
            for (n in t)
              void 0 !== t[n] && ((o[n] ? e : r || (r = {}))[n] = t[n]);
            return r && C.extend(!0, e, r), e;
          }
          (Ut.href = kt.href),
            C.extend({
              active: 0,
              lastModified: {},
              etag: {},
              ajaxSettings: {
                url: kt.href,
                type: "GET",
                isLocal:
                  /^(?:about|app|app-storage|.+-extension|file|res|widget):$/.test(
                    kt.protocol,
                  ),
                global: !0,
                processData: !0,
                async: !0,
                contentType: "application/x-www-form-urlencoded; charset=UTF-8",
                accepts: {
                  "*": Vt,
                  text: "text/plain",
                  html: "text/html",
                  xml: "application/xml, text/xml",
                  json: "application/json, text/javascript",
                },
                contents: { xml: /\bxml\b/, html: /\bhtml/, json: /\bjson\b/ },
                responseFields: {
                  xml: "responseXML",
                  text: "responseText",
                  json: "responseJSON",
                },
                converters: {
                  "* text": String,
                  "text html": !0,
                  "text json": JSON.parse,
                  "text xml": C.parseXML,
                },
                flatOptions: { url: !0, context: !0 },
              },
              ajaxSetup: function (e, t) {
                return t ? Xt(Xt(e, C.ajaxSettings), t) : Xt(C.ajaxSettings, e);
              },
              ajaxPrefilter: zt(Bt),
              ajaxTransport: zt(Wt),
              ajax: function (t, n) {
                "object" == typeof t && ((n = t), (t = void 0)), (n = n || {});
                var r,
                  o,
                  i,
                  s,
                  a,
                  u,
                  c,
                  l,
                  d,
                  p,
                  f = C.ajaxSetup({}, n),
                  h = f.context || f,
                  g = f.context && (h.nodeType || h.jquery) ? C(h) : C.event,
                  y = C.Deferred(),
                  v = C.Callbacks("once memory"),
                  x = f.statusCode || {},
                  w = {},
                  b = {},
                  T = "canceled",
                  E = {
                    readyState: 0,
                    getResponseHeader: function (e) {
                      var t;
                      if (c) {
                        if (!s)
                          for (s = {}; (t = qt.exec(i)); )
                            s[t[1].toLowerCase() + " "] = (
                              s[t[1].toLowerCase() + " "] || []
                            ).concat(t[2]);
                        t = s[e.toLowerCase() + " "];
                      }
                      return null == t ? null : t.join(", ");
                    },
                    getAllResponseHeaders: function () {
                      return c ? i : null;
                    },
                    setRequestHeader: function (e, t) {
                      return (
                        null == c &&
                          ((e = b[e.toLowerCase()] = b[e.toLowerCase()] || e),
                          (w[e] = t)),
                        this
                      );
                    },
                    overrideMimeType: function (e) {
                      return null == c && (f.mimeType = e), this;
                    },
                    statusCode: function (e) {
                      var t;
                      if (e)
                        if (c) E.always(e[E.status]);
                        else for (t in e) x[t] = [x[t], e[t]];
                      return this;
                    },
                    abort: function (e) {
                      var t = e || T;
                      return r && r.abort(t), S(0, t), this;
                    },
                  };
                if (
                  (y.promise(E),
                  (f.url = ((t || f.url || kt.href) + "").replace(
                    Ht,
                    kt.protocol + "//",
                  )),
                  (f.type = n.method || n.type || f.method || f.type),
                  (f.dataTypes = (f.dataType || "*").toLowerCase().match(V) || [
                    "",
                  ]),
                  null == f.crossDomain)
                ) {
                  u = m.createElement("a");
                  try {
                    (u.href = f.url),
                      (u.href = u.href),
                      (f.crossDomain =
                        Ut.protocol + "//" + Ut.host !=
                        u.protocol + "//" + u.host);
                  } catch (k) {
                    f.crossDomain = !0;
                  }
                }
                if (
                  (f.data &&
                    f.processData &&
                    "string" != typeof f.data &&
                    (f.data = C.param(f.data, f.traditional)),
                  Gt(Bt, f, n, E),
                  c)
                )
                  return E;
                for (d in ((l = C.event && f.global) &&
                  0 === C.active++ &&
                  C.event.trigger("ajaxStart"),
                (f.type = f.type.toUpperCase()),
                (f.hasContent = !Ft.test(f.type)),
                (o = f.url.replace(Ot, "")),
                f.hasContent
                  ? f.data &&
                    f.processData &&
                    0 ===
                      (f.contentType || "").indexOf(
                        "application/x-www-form-urlencoded",
                      ) &&
                    (f.data = f.data.replace(Mt, "+"))
                  : ((p = f.url.slice(o.length)),
                    f.data &&
                      (f.processData || "string" == typeof f.data) &&
                      ((o += (At.test(o) ? "&" : "?") + f.data), delete f.data),
                    !1 === f.cache &&
                      ((o = o.replace(Lt, "$1")),
                      (p = (At.test(o) ? "&" : "?") + "_=" + It.guid++ + p)),
                    (f.url = o + p)),
                f.ifModified &&
                  (C.lastModified[o] &&
                    E.setRequestHeader("If-Modified-Since", C.lastModified[o]),
                  C.etag[o] && E.setRequestHeader("If-None-Match", C.etag[o])),
                ((f.data && f.hasContent && !1 !== f.contentType) ||
                  n.contentType) &&
                  E.setRequestHeader("Content-Type", f.contentType),
                E.setRequestHeader(
                  "Accept",
                  f.dataTypes[0] && f.accepts[f.dataTypes[0]]
                    ? f.accepts[f.dataTypes[0]] +
                        ("*" !== f.dataTypes[0] ? ", " + Vt + "; q=0.01" : "")
                    : f.accepts["*"],
                ),
                f.headers))
                  E.setRequestHeader(d, f.headers[d]);
                if (f.beforeSend && (!1 === f.beforeSend.call(h, E, f) || c))
                  return E.abort();
                if (
                  ((T = "abort"),
                  v.add(f.complete),
                  E.done(f.success),
                  E.fail(f.error),
                  (r = Gt(Wt, f, n, E)))
                ) {
                  if (
                    ((E.readyState = 1), l && g.trigger("ajaxSend", [E, f]), c)
                  )
                    return E;
                  f.async &&
                    f.timeout > 0 &&
                    (a = e.setTimeout(function () {
                      E.abort("timeout");
                    }, f.timeout));
                  try {
                    (c = !1), r.send(w, S);
                  } catch (k) {
                    if (c) throw k;
                    S(-1, k);
                  }
                } else S(-1, "No Transport");
                function S(t, n, s, u) {
                  var d,
                    p,
                    m,
                    w,
                    b,
                    T = n;
                  c ||
                    ((c = !0),
                    a && e.clearTimeout(a),
                    (r = void 0),
                    (i = u || ""),
                    (E.readyState = t > 0 ? 4 : 0),
                    (d = (t >= 200 && t < 300) || 304 === t),
                    s &&
                      (w = (function (e, t, n) {
                        for (
                          var r, o, i, s, a = e.contents, u = e.dataTypes;
                          "*" === u[0];

                        )
                          u.shift(),
                            void 0 === r &&
                              (r =
                                e.mimeType ||
                                t.getResponseHeader("Content-Type"));
                        if (r)
                          for (o in a)
                            if (a[o] && a[o].test(r)) {
                              u.unshift(o);
                              break;
                            }
                        if (u[0] in n) i = u[0];
                        else {
                          for (o in n) {
                            if (!u[0] || e.converters[o + " " + u[0]]) {
                              i = o;
                              break;
                            }
                            s || (s = o);
                          }
                          i = i || s;
                        }
                        if (i) return i !== u[0] && u.unshift(i), n[i];
                      })(f, E, s)),
                    !d &&
                      C.inArray("script", f.dataTypes) > -1 &&
                      C.inArray("json", f.dataTypes) < 0 &&
                      (f.converters["text script"] = function () {}),
                    (w = (function (e, t, n, r) {
                      var o,
                        i,
                        s,
                        a,
                        u,
                        c = {},
                        l = e.dataTypes.slice();
                      if (l[1])
                        for (s in e.converters)
                          c[s.toLowerCase()] = e.converters[s];
                      for (i = l.shift(); i; )
                        if (
                          (e.responseFields[i] && (n[e.responseFields[i]] = t),
                          !u &&
                            r &&
                            e.dataFilter &&
                            (t = e.dataFilter(t, e.dataType)),
                          (u = i),
                          (i = l.shift()))
                        )
                          if ("*" === i) i = u;
                          else if ("*" !== u && u !== i) {
                            if (!(s = c[u + " " + i] || c["* " + i]))
                              for (o in c)
                                if (
                                  (a = o.split(" "))[1] === i &&
                                  (s = c[u + " " + a[0]] || c["* " + a[0]])
                                ) {
                                  !0 === s
                                    ? (s = c[o])
                                    : !0 !== c[o] &&
                                      ((i = a[0]), l.unshift(a[1]));
                                  break;
                                }
                            if (!0 !== s)
                              if (s && e.throws) t = s(t);
                              else
                                try {
                                  t = s(t);
                                } catch (k) {
                                  return {
                                    state: "parsererror",
                                    error: s
                                      ? k
                                      : "No conversion from " + u + " to " + i,
                                  };
                                }
                          }
                      return { state: "success", data: t };
                    })(f, w, E, d)),
                    d
                      ? (f.ifModified &&
                          ((b = E.getResponseHeader("Last-Modified")) &&
                            (C.lastModified[o] = b),
                          (b = E.getResponseHeader("etag")) && (C.etag[o] = b)),
                        204 === t || "HEAD" === f.type
                          ? (T = "nocontent")
                          : 304 === t
                            ? (T = "notmodified")
                            : ((T = w.state),
                              (p = w.data),
                              (d = !(m = w.error))))
                      : ((m = T),
                        (!t && T) || ((T = "error"), t < 0 && (t = 0))),
                    (E.status = t),
                    (E.statusText = (n || T) + ""),
                    d
                      ? y.resolveWith(h, [p, T, E])
                      : y.rejectWith(h, [E, T, m]),
                    E.statusCode(x),
                    (x = void 0),
                    l &&
                      g.trigger(d ? "ajaxSuccess" : "ajaxError", [
                        E,
                        f,
                        d ? p : m,
                      ]),
                    v.fireWith(h, [E, T]),
                    l &&
                      (g.trigger("ajaxComplete", [E, f]),
                      --C.active || C.event.trigger("ajaxStop")));
                }
                return E;
              },
              getJSON: function (e, t, n) {
                return C.get(e, t, n, "json");
              },
              getScript: function (e, t) {
                return C.get(e, void 0, t, "script");
              },
            }),
            C.each(["get", "post"], function (e, t) {
              C[t] = function (e, n, r, o) {
                return (
                  h(n) && ((o = o || r), (r = n), (n = void 0)),
                  C.ajax(
                    C.extend(
                      { url: e, type: t, dataType: o, data: n, success: r },
                      C.isPlainObject(e) && e,
                    ),
                  )
                );
              };
            }),
            C.ajaxPrefilter(function (e) {
              var t;
              for (t in e.headers)
                "content-type" === t.toLowerCase() &&
                  (e.contentType = e.headers[t] || "");
            }),
            (C._evalUrl = function (e, t, n) {
              return C.ajax({
                url: e,
                type: "GET",
                dataType: "script",
                cache: !0,
                async: !1,
                global: !1,
                converters: { "text script": function () {} },
                dataFilter: function (e) {
                  C.globalEval(e, t, n);
                },
              });
            }),
            C.fn.extend({
              wrapAll: function (e) {
                var t;
                return (
                  this[0] &&
                    (h(e) && (e = e.call(this[0])),
                    (t = C(e, this[0].ownerDocument).eq(0).clone(!0)),
                    this[0].parentNode && t.insertBefore(this[0]),
                    t
                      .map(function () {
                        for (var e = this; e.firstElementChild; )
                          e = e.firstElementChild;
                        return e;
                      })
                      .append(this)),
                  this
                );
              },
              wrapInner: function (e) {
                return h(e)
                  ? this.each(function (t) {
                      C(this).wrapInner(e.call(this, t));
                    })
                  : this.each(function () {
                      var t = C(this),
                        n = t.contents();
                      n.length ? n.wrapAll(e) : t.append(e);
                    });
              },
              wrap: function (e) {
                var t = h(e);
                return this.each(function (n) {
                  C(this).wrapAll(t ? e.call(this, n) : e);
                });
              },
              unwrap: function (e) {
                return (
                  this.parent(e)
                    .not("body")
                    .each(function () {
                      C(this).replaceWith(this.childNodes);
                    }),
                  this
                );
              },
            }),
            (C.expr.pseudos.hidden = function (e) {
              return !C.expr.pseudos.visible(e);
            }),
            (C.expr.pseudos.visible = function (e) {
              return !!(
                e.offsetWidth ||
                e.offsetHeight ||
                e.getClientRects().length
              );
            }),
            (C.ajaxSettings.xhr = function () {
              try {
                return new e.XMLHttpRequest();
              } catch (t) {}
            });
          var Qt = { 0: 200, 1223: 204 },
            Yt = C.ajaxSettings.xhr();
          (f.cors = !!Yt && "withCredentials" in Yt),
            (f.ajax = Yt = !!Yt),
            C.ajaxTransport(function (t) {
              var n, r;
              if (f.cors || (Yt && !t.crossDomain))
                return {
                  send: function (o, i) {
                    var s,
                      a = t.xhr();
                    if (
                      (a.open(t.type, t.url, t.async, t.username, t.password),
                      t.xhrFields)
                    )
                      for (s in t.xhrFields) a[s] = t.xhrFields[s];
                    for (s in (t.mimeType &&
                      a.overrideMimeType &&
                      a.overrideMimeType(t.mimeType),
                    t.crossDomain ||
                      o["X-Requested-With"] ||
                      (o["X-Requested-With"] = "XMLHttpRequest"),
                    o))
                      a.setRequestHeader(s, o[s]);
                    (n = function (e) {
                      return function () {
                        n &&
                          ((n =
                            r =
                            a.onload =
                            a.onerror =
                            a.onabort =
                            a.ontimeout =
                            a.onreadystatechange =
                              null),
                          "abort" === e
                            ? a.abort()
                            : "error" === e
                              ? "number" != typeof a.status
                                ? i(0, "error")
                                : i(a.status, a.statusText)
                              : i(
                                  Qt[a.status] || a.status,
                                  a.statusText,
                                  "text" !== (a.responseType || "text") ||
                                    "string" != typeof a.responseText
                                    ? { binary: a.response }
                                    : { text: a.responseText },
                                  a.getAllResponseHeaders(),
                                ));
                      };
                    }),
                      (a.onload = n()),
                      (r = a.onerror = a.ontimeout = n("error")),
                      void 0 !== a.onabort
                        ? (a.onabort = r)
                        : (a.onreadystatechange = function () {
                            4 === a.readyState &&
                              e.setTimeout(function () {
                                n && r();
                              });
                          }),
                      (n = n("abort"));
                    try {
                      a.send((t.hasContent && t.data) || null);
                    } catch (u) {
                      if (n) throw u;
                    }
                  },
                  abort: function () {
                    n && n();
                  },
                };
            }),
            C.ajaxPrefilter(function (e) {
              e.crossDomain && (e.contents.script = !1);
            }),
            C.ajaxSetup({
              accepts: {
                script:
                  "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript",
              },
              contents: { script: /\b(?:java|ecma)script\b/ },
              converters: {
                "text script": function (e) {
                  return C.globalEval(e), e;
                },
              },
            }),
            C.ajaxPrefilter("script", function (e) {
              void 0 === e.cache && (e.cache = !1),
                e.crossDomain && (e.type = "GET");
            }),
            C.ajaxTransport("script", function (e) {
              var t, n;
              if (e.crossDomain || e.scriptAttrs)
                return {
                  send: function (r, o) {
                    (t = C("<script>")
                      .attr(e.scriptAttrs || {})
                      .prop({ charset: e.scriptCharset, src: e.url })
                      .on(
                        "load error",
                        (n = function (e) {
                          t.remove(),
                            (n = null),
                            e && o("error" === e.type ? 404 : 200, e.type);
                        }),
                      )),
                      m.head.appendChild(t[0]);
                  },
                  abort: function () {
                    n && n();
                  },
                };
            });
          var Jt,
            Kt = [],
            Zt = /(=)\?(?=&|$)|\?\?/;
          C.ajaxSetup({
            jsonp: "callback",
            jsonpCallback: function () {
              var e = Kt.pop() || C.expando + "_" + It.guid++;
              return (this[e] = !0), e;
            },
          }),
            C.ajaxPrefilter("json jsonp", function (t, n, r) {
              var o,
                i,
                s,
                a =
                  !1 !== t.jsonp &&
                  (Zt.test(t.url)
                    ? "url"
                    : "string" == typeof t.data &&
                      0 ===
                        (t.contentType || "").indexOf(
                          "application/x-www-form-urlencoded",
                        ) &&
                      Zt.test(t.data) &&
                      "data");
              if (a || "jsonp" === t.dataTypes[0])
                return (
                  (o = t.jsonpCallback =
                    h(t.jsonpCallback) ? t.jsonpCallback() : t.jsonpCallback),
                  a
                    ? (t[a] = t[a].replace(Zt, "$1" + o))
                    : !1 !== t.jsonp &&
                      (t.url +=
                        (At.test(t.url) ? "&" : "?") + t.jsonp + "=" + o),
                  (t.converters["script json"] = function () {
                    return s || C.error(o + " was not called"), s[0];
                  }),
                  (t.dataTypes[0] = "json"),
                  (i = e[o]),
                  (e[o] = function () {
                    s = arguments;
                  }),
                  r.always(function () {
                    void 0 === i ? C(e).removeProp(o) : (e[o] = i),
                      t[o] && ((t.jsonpCallback = n.jsonpCallback), Kt.push(o)),
                      s && h(i) && i(s[0]),
                      (s = i = void 0);
                  }),
                  "script"
                );
            }),
            (f.createHTMLDocument =
              (((Jt = m.implementation.createHTMLDocument("").body).innerHTML =
                "<form></form><form></form>"),
              2 === Jt.childNodes.length)),
            (C.parseHTML = function (e, t, n) {
              return "string" != typeof e
                ? []
                : ("boolean" == typeof t && ((n = t), (t = !1)),
                  t ||
                    (f.createHTMLDocument
                      ? (((r = (t =
                          m.implementation.createHTMLDocument(
                            "",
                          )).createElement("base")).href = m.location.href),
                        t.head.appendChild(r))
                      : (t = m)),
                  (i = !n && []),
                  (o = O.exec(e))
                    ? [t.createElement(o[1])]
                    : ((o = De([e], t, i)),
                      i && i.length && C(i).remove(),
                      C.merge([], o.childNodes)));
              var r, o, i;
            }),
            (C.fn.load = function (e, t, n) {
              var r,
                o,
                i,
                s = this,
                a = e.indexOf(" ");
              return (
                a > -1 && ((r = Ct(e.slice(a))), (e = e.slice(0, a))),
                h(t)
                  ? ((n = t), (t = void 0))
                  : t && "object" == typeof t && (o = "POST"),
                s.length > 0 &&
                  C.ajax({
                    url: e,
                    type: o || "GET",
                    dataType: "html",
                    data: t,
                  })
                    .done(function (e) {
                      (i = arguments),
                        s.html(
                          r ? C("<div>").append(C.parseHTML(e)).find(r) : e,
                        );
                    })
                    .always(
                      n &&
                        function (e, t) {
                          s.each(function () {
                            n.apply(this, i || [e.responseText, t, e]);
                          });
                        },
                    ),
                this
              );
            }),
            (C.expr.pseudos.animated = function (e) {
              return C.grep(C.timers, function (t) {
                return e === t.elem;
              }).length;
            }),
            (C.offset = {
              setOffset: function (e, t, n) {
                var r,
                  o,
                  i,
                  s,
                  a,
                  u,
                  c = C.css(e, "position"),
                  l = C(e),
                  d = {};
                "static" === c && (e.style.position = "relative"),
                  (a = l.offset()),
                  (i = C.css(e, "top")),
                  (u = C.css(e, "left")),
                  ("absolute" === c || "fixed" === c) &&
                  (i + u).indexOf("auto") > -1
                    ? ((s = (r = l.position()).top), (o = r.left))
                    : ((s = parseFloat(i) || 0), (o = parseFloat(u) || 0)),
                  h(t) && (t = t.call(e, n, C.extend({}, a))),
                  null != t.top && (d.top = t.top - a.top + s),
                  null != t.left && (d.left = t.left - a.left + o),
                  "using" in t ? t.using.call(e, d) : l.css(d);
              },
            }),
            C.fn.extend({
              offset: function (e) {
                if (arguments.length)
                  return void 0 === e
                    ? this
                    : this.each(function (t) {
                        C.offset.setOffset(this, e, t);
                      });
                var t,
                  n,
                  r = this[0];
                return r
                  ? r.getClientRects().length
                    ? ((t = r.getBoundingClientRect()),
                      (n = r.ownerDocument.defaultView),
                      {
                        top: t.top + n.pageYOffset,
                        left: t.left + n.pageXOffset,
                      })
                    : { top: 0, left: 0 }
                  : void 0;
              },
              position: function () {
                if (this[0]) {
                  var e,
                    t,
                    n,
                    r = this[0],
                    o = { top: 0, left: 0 };
                  if ("fixed" === C.css(r, "position"))
                    t = r.getBoundingClientRect();
                  else {
                    for (
                      t = this.offset(),
                        n = r.ownerDocument,
                        e = r.offsetParent || n.documentElement;
                      e &&
                      (e === n.body || e === n.documentElement) &&
                      "static" === C.css(e, "position");

                    )
                      e = e.parentNode;
                    e &&
                      e !== r &&
                      1 === e.nodeType &&
                      (((o = C(e).offset()).top += C.css(
                        e,
                        "borderTopWidth",
                        !0,
                      )),
                      (o.left += C.css(e, "borderLeftWidth", !0)));
                  }
                  return {
                    top: t.top - o.top - C.css(r, "marginTop", !0),
                    left: t.left - o.left - C.css(r, "marginLeft", !0),
                  };
                }
              },
              offsetParent: function () {
                return this.map(function () {
                  for (
                    var e = this.offsetParent;
                    e && "static" === C.css(e, "position");

                  )
                    e = e.offsetParent;
                  return e || pe;
                });
              },
            }),
            C.each(
              { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" },
              function (e, t) {
                var n = "pageYOffset" === t;
                C.fn[e] = function (r) {
                  return J(
                    this,
                    function (e, r, o) {
                      var i;
                      if (
                        (g(e)
                          ? (i = e)
                          : 9 === e.nodeType && (i = e.defaultView),
                        void 0 === o)
                      )
                        return i ? i[t] : e[r];
                      i
                        ? i.scrollTo(
                            n ? i.pageXOffset : o,
                            n ? o : i.pageYOffset,
                          )
                        : (e[r] = o);
                    },
                    e,
                    r,
                    arguments.length,
                  );
                };
              },
            ),
            C.each(["top", "left"], function (e, t) {
              C.cssHooks[t] = Je(f.pixelPosition, function (e, n) {
                if (n)
                  return (
                    (n = Ye(e, t)), Ue.test(n) ? C(e).position()[t] + "px" : n
                  );
              });
            }),
            C.each({ Height: "height", Width: "width" }, function (e, t) {
              C.each(
                { padding: "inner" + e, content: t, "": "outer" + e },
                function (n, r) {
                  C.fn[r] = function (o, i) {
                    var s = arguments.length && (n || "boolean" != typeof o),
                      a = n || (!0 === o || !0 === i ? "margin" : "border");
                    return J(
                      this,
                      function (t, n, o) {
                        var i;
                        return g(t)
                          ? 0 === r.indexOf("outer")
                            ? t["inner" + e]
                            : t.document.documentElement["client" + e]
                          : 9 === t.nodeType
                            ? ((i = t.documentElement),
                              Math.max(
                                t.body["scroll" + e],
                                i["scroll" + e],
                                t.body["offset" + e],
                                i["offset" + e],
                                i["client" + e],
                              ))
                            : void 0 === o
                              ? C.css(t, n, a)
                              : C.style(t, n, o, a);
                      },
                      t,
                      s ? o : void 0,
                      s,
                    );
                  };
                },
              );
            }),
            C.each(
              [
                "ajaxStart",
                "ajaxStop",
                "ajaxComplete",
                "ajaxError",
                "ajaxSuccess",
                "ajaxSend",
              ],
              function (e, t) {
                C.fn[t] = function (e) {
                  return this.on(t, e);
                };
              },
            ),
            C.fn.extend({
              bind: function (e, t, n) {
                return this.on(e, null, t, n);
              },
              unbind: function (e, t) {
                return this.off(e, null, t);
              },
              delegate: function (e, t, n, r) {
                return this.on(t, e, n, r);
              },
              undelegate: function (e, t, n) {
                return 1 === arguments.length
                  ? this.off(e, "**")
                  : this.off(t, e || "**", n);
              },
              hover: function (e, t) {
                return this.on("mouseenter", e).on("mouseleave", t || e);
              },
            }),
            C.each(
              "blur focus focusin focusout resize scroll click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup contextmenu".split(
                " ",
              ),
              function (e, t) {
                C.fn[t] = function (e, n) {
                  return arguments.length > 0
                    ? this.on(t, null, e, n)
                    : this.trigger(t);
                };
              },
            );
          var en = /^[\s\uFEFF\xA0]+|([^\s\uFEFF\xA0])[\s\uFEFF\xA0]+$/g;
          (C.proxy = function (e, t) {
            var n, r, i;
            if (("string" == typeof t && ((n = e[t]), (t = e), (e = n)), h(e)))
              return (
                (r = o.call(arguments, 2)),
                (i = function () {
                  return e.apply(t || this, r.concat(o.call(arguments)));
                }),
                (i.guid = e.guid = e.guid || C.guid++),
                i
              );
          }),
            (C.holdReady = function (e) {
              e ? C.readyWait++ : C.ready(!0);
            }),
            (C.isArray = Array.isArray),
            (C.parseJSON = JSON.parse),
            (C.nodeName = E),
            (C.isFunction = h),
            (C.isWindow = g),
            (C.camelCase = te),
            (C.type = x),
            (C.now = Date.now),
            (C.isNumeric = function (e) {
              var t = C.type(e);
              return (
                ("number" === t || "string" === t) && !isNaN(e - parseFloat(e))
              );
            }),
            (C.trim = function (e) {
              return null == e ? "" : (e + "").replace(en, "$1");
            });
          var tn = e.jQuery,
            nn = e.$;
          return (
            (C.noConflict = function (t) {
              return (
                e.$ === C && (e.$ = nn),
                t && e.jQuery === C && (e.jQuery = tn),
                C
              );
            }),
            void 0 === t && (e.jQuery = e.$ = C),
            C
          );
        }),
        (i.exports = r.document
          ? o(r, !0)
          : function (e) {
              if (!e.document)
                throw new Error("jQuery requires a window with a document");
              return o(e);
            })),
  ),
  a = new Error("request for lock canceled");
var u = function (e, t, n, r) {
  return new (n || (n = Promise))(function (o, i) {
    function s(e) {
      try {
        u(r.next(e));
      } catch (t) {
        i(t);
      }
    }
    function a(e) {
      try {
        u(r.throw(e));
      } catch (t) {
        i(t);
      }
    }
    function u(e) {
      var t;
      e.done
        ? o(e.value)
        : ((t = e.value),
          t instanceof n
            ? t
            : new n(function (e) {
                e(t);
              })).then(s, a);
    }
    u((r = r.apply(e, t || [])).next());
  });
};
class c {
  constructor(e, t = a) {
    (this._value = e),
      (this._cancelError = t),
      (this._queue = []),
      (this._weightedWaiters = []);
  }
  acquire(e = 1, t = 0) {
    if (e <= 0) throw new Error(`invalid weight ${e}: must be positive`);
    return new Promise((n, r) => {
      const o = { resolve: n, reject: r, weight: e, priority: t },
        i = l(this._queue, (e) => t <= e.priority);
      -1 === i && e <= this._value
        ? this._dispatchItem(o)
        : this._queue.splice(i + 1, 0, o);
    });
  }
  runExclusive(e) {
    return u(this, arguments, void 0, function* (e, t = 1, n = 0) {
      const [r, o] = yield this.acquire(t, n);
      try {
        return yield e(r);
      } finally {
        o();
      }
    });
  }
  waitForUnlock(e = 1, t = 0) {
    if (e <= 0) throw new Error(`invalid weight ${e}: must be positive`);
    return this._couldLockImmediately(e, t)
      ? Promise.resolve()
      : new Promise((n) => {
          this._weightedWaiters[e - 1] || (this._weightedWaiters[e - 1] = []),
            (function (e, t) {
              const n = l(e, (e) => t.priority <= e.priority);
              e.splice(n + 1, 0, t);
            })(this._weightedWaiters[e - 1], { resolve: n, priority: t });
        });
  }
  isLocked() {
    return this._value <= 0;
  }
  getValue() {
    return this._value;
  }
  setValue(e) {
    (this._value = e), this._dispatchQueue();
  }
  release(e = 1) {
    if (e <= 0) throw new Error(`invalid weight ${e}: must be positive`);
    (this._value += e), this._dispatchQueue();
  }
  cancel() {
    this._queue.forEach((e) => e.reject(this._cancelError)), (this._queue = []);
  }
  _dispatchQueue() {
    for (
      this._drainUnlockWaiters();
      this._queue.length > 0 && this._queue[0].weight <= this._value;

    )
      this._dispatchItem(this._queue.shift()), this._drainUnlockWaiters();
  }
  _dispatchItem(e) {
    const t = this._value;
    (this._value -= e.weight), e.resolve([t, this._newReleaser(e.weight)]);
  }
  _newReleaser(e) {
    let t = !1;
    return () => {
      t || ((t = !0), this.release(e));
    };
  }
  _drainUnlockWaiters() {
    if (0 === this._queue.length)
      for (let e = this._value; e > 0; e--) {
        const t = this._weightedWaiters[e - 1];
        t &&
          (t.forEach((e) => e.resolve()), (this._weightedWaiters[e - 1] = []));
      }
    else {
      const e = this._queue[0].priority;
      for (let t = this._value; t > 0; t--) {
        const n = this._weightedWaiters[t - 1];
        if (!n) continue;
        const r = n.findIndex((t) => t.priority <= e);
        (-1 === r ? n : n.splice(0, r)).forEach((e) => e.resolve());
      }
    }
  }
  _couldLockImmediately(e, t) {
    return (
      (0 === this._queue.length || this._queue[0].priority < t) &&
      e <= this._value
    );
  }
}
function l(e, t) {
  for (let n = e.length - 1; n >= 0; n--) if (t(e[n])) return n;
  return -1;
}
var d = function (e, t, n, r) {
  return new (n || (n = Promise))(function (o, i) {
    function s(e) {
      try {
        u(r.next(e));
      } catch (t) {
        i(t);
      }
    }
    function a(e) {
      try {
        u(r.throw(e));
      } catch (t) {
        i(t);
      }
    }
    function u(e) {
      var t;
      e.done
        ? o(e.value)
        : ((t = e.value),
          t instanceof n
            ? t
            : new n(function (e) {
                e(t);
              })).then(s, a);
    }
    u((r = r.apply(e, t || [])).next());
  });
};
const p = new (class {
    constructor(e) {
      this._semaphore = new c(1, e);
    }
    acquire() {
      return d(this, arguments, void 0, function* (e = 0) {
        const [, t] = yield this._semaphore.acquire(1, e);
        return t;
      });
    }
    runExclusive(e, t = 0) {
      return this._semaphore.runExclusive(() => e(), 1, t);
    }
    isLocked() {
      return this._semaphore.isLocked();
    }
    waitForUnlock(e = 0) {
      return this._semaphore.waitForUnlock(1, e);
    }
    release() {
      this._semaphore.isLocked() && this._semaphore.release();
    }
    cancel() {
      return this._semaphore.cancel();
    }
  })(),
  f = (e, t, n = !1) => {
    const r = n ? e * (0.6 + 0.8 * Math.random()) : e;
    if (document.hidden) return ocSleep(r, t);
    return new Promise(
      t
        ? (e, n) => {
            const o = Date.now(),
              i = setInterval(() => {
                if (t && t())
                  return clearInterval(i), void n(new Error("Cancelled"));
                Date.now() - o >= r && (clearInterval(i), e());
              }, 50);
          }
        : (e) => setTimeout(e, r),
    );
  },
  // Background (hidden/minimised) tabs: debugger Input.* commands report success but are not
  // applied, while DOM-level editing and synthetic events work. Use DOM paths when hidden.
  h = async (e) => {
    try {
      if (document.execCommand("insertText", !1, e)) return !0;
    } catch {}
    try {
      const t = await chrome.runtime.sendMessage({ type: "CIT", text: e });
      if (t?.success) return !0;
    } catch {}
    return !1;
  },
  g = async (e, t, n, r) => {
    let o,
      i = r;
    "@" === e && ((o = "@"), (i = 8));
    if (ocDomInput || document.hidden) {
      if ("@" === e)
        try {
          return document.execCommand("insertText", !1, "@");
        } catch {
          return !1;
        }
      const el = document.activeElement || document.body,
        opts = {
          key: e,
          code: t,
          keyCode: n,
          which: n,
          bubbles: !0,
          cancelable: !0,
          composed: !0,
          ctrlKey: 2 === r,
          shiftKey: 8 === r,
        };
      el.dispatchEvent(new KeyboardEvent("keydown", opts)),
        el.dispatchEvent(new KeyboardEvent("keyup", opts));
      return !0;
    }
    try {
      const r = await chrome.runtime.sendMessage({
        type: "CK",
        key: e,
        code: t,
        keyCode: n,
        text: o,
        modifiers: i,
      });
      return !!r?.success;
    } catch {
      return !1;
    }
  },
  m = (e) => {
    if (!e || 0 === e.length) return !1;
    const t = e[0];
    if (!t) return !1;
    if (
      t.disabled ||
      "true" === t.getAttribute("aria-disabled") ||
      "true" === t.getAttribute("disabled")
    )
      return !1;
    const r = window.getComputedStyle(t);
    if ("none" === r.display || "hidden" === r.visibility || "0" === r.opacity)
      return !1;
    const n = t.getBoundingClientRect();
    return !(0 === n.width && 0 === n.height);
  },
  // jQuery returns comma-selector matches in document order, so the first match can be a
  // hidden twin (e.g. the welcome dialog's "Tạo video ngang" button). Prefer the first usable one.
  ocPick = (e) => {
    const t = s(e);
    if (t.length < 2) return t;
    for (let n = 0; n < t.length; n++) if (m(t.eq(n))) return t.eq(n);
    return t;
  },
  y = async (e, t, n = 5e3, r = 100, o = !0) => {
    const i = Date.now();
    for (; Date.now() - i < n; ) {
      if (t && t()) throw new Error("Cancelled");
      const n = o ? ocPick(e) : s(e);
      if (o ? m(n) : n.length > 0) return await f(200, t), n;
      await f(r, t);
    }
    return null;
  },
  // Activates an element exactly once. Firing synthetic click + el.click() + a debugger
  // click on the same element triggered toggles/Generate up to three times.
  ocSynthClick = (el) => {
    const rect = el.getBoundingClientRect(),
      evOpts = {
        bubbles: !0,
        cancelable: !0,
        composed: !0,
        view: window,
        clientX: Math.round(rect.left + rect.width / 2),
        clientY: Math.round(rect.top + rect.height / 2),
      };
    for (const [Ctor, type] of [
      [PointerEvent, "pointerdown"],
      [MouseEvent, "mousedown"],
      [PointerEvent, "pointerup"],
      [MouseEvent, "mouseup"],
      [MouseEvent, "click"],
    ])
      try {
        el.dispatchEvent(new Ctor(type, evOpts));
      } catch (err) {}
  },
  ocClickOnce = async (el) => {
    await ocZoomSettled;
    const rect = el.getBoundingClientRect(),
      cx = Math.round(rect.left + rect.width / 2),
      cy = Math.round(rect.top + rect.height / 2),
      hit =
        typeof document.elementFromPoint == "function"
          ? document.elementFromPoint(cx, cy)
          : null;
    const ocHitOk = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
    let ocCC = ocDomInput ? "dom" : document.hidden ? "hidden-tab" : "skipped";
    if (ocHitOk && !ocDomInput && !document.hidden)
      try {
        const res = await chrome.runtime.sendMessage({
          type: "CC",
          x: Math.round(cx * ocZoom),
          y: Math.round(cy * ocZoom),
        });
        ocCC = res?.success ? "ok" : "fail:" + (res?.error || "").slice(0, 80);
      } catch (err) {
        ocCC = "throw:" + String(err).slice(0, 80);
      }
    if (ocCC === "ok") return;
    ocSynthClick(el);
  },
  v = async (e, t = "Undefined element button", n, r = 5e3, o = 100) =>
    p.runExclusive(async () => {
      const i = Date.now();
      for (; Date.now() - i < r; ) {
        if (n && n()) throw new Error("Cancelled");
        await f(o, n);
        const elColl = ocPick(e);
        if (m(elColl)) {
          const el = elColl.get(0);
          if (el) {
            try {
              el.scrollIntoView({
                block: "center",
                inline: "center",
                behavior: "instant",
              });
            } catch (err) {}
            try {
              el.focus();
            } catch (err) {}
            await ocClickOnce(el);
            await f(300, n);
          }
          return;
        }
      }
      if (n && n()) throw new Error("Cancelled");
      throw 0 === s(e).length
        ? new Error(
            `\u274c ${t} - Element not found: ${e} within timeout (${r}ms)`,
          )
        : new Error(
            `\u274c ${t} - Element found but not fully visible/ready within timeout (${r}ms)`,
          );
    }),
  x = async (e) => {
    if (!e || 0 === e.length) return null;
    const t = e[e.length - 1];
    try {
      const e = await ((e) =>
        new Promise((t, n) => {
          (e.crossOrigin = "anonymous"),
            (e.preload = "auto"),
            e.addEventListener("loadedmetadata", () => {
              e.currentTime = e.duration;
            }),
            e.addEventListener("seeked", () => {
              const r = document.createElement("canvas");
              (r.width = e.videoWidth), (r.height = e.videoHeight);
              const o = r.getContext("2d");
              if (!o) return void n(new Error("Could not get canvas context"));
              o.drawImage(e, 0, 0, r.width, r.height);
              const i = r.toDataURL("image/jpeg", 0.95);
              t(i);
            }),
            e.addEventListener("error", (e) => {
              n(
                new Error(
                  `Failed to load video: ${e.message || "Unknown error"}`,
                ),
              );
            });
          const r = e.src || e.currentSrc;
          r ? ((e.src = ""), (e.src = r), e.load()) : e.load();
        }))(t);
      return e;
    } catch (n) {
      n instanceof Error ? n.message : String(n);
      return null;
    }
  },
  w = (e) => {
    if (!e) return "video";
    let t = e.replace(/\s+/g, "-");
    return (
      (t = t.replace(/[^\p{L}\p{N}-]/gu, "")),
      (t = t.replace(/-+/g, "-")),
      (t = t.replace(/^-+|-+$/g, "")),
      t.length > 50 && (t = t.substring(0, 50)),
      t || "video"
    );
  },
  b = () => window.location.href.includes("docs.google.com/videos"),
  C = (e) => {
    try {
      chrome.runtime
        .sendMessage({ type: "ACTION_LOG", data: e })
        .catch(() => {});
    } catch (t) {}
  },
  T = (e) =>
    e
      .map((e) =>
        "string" == typeof e
          ? e
          : e instanceof Error
            ? e.message
            : JSON.stringify(e),
      )
      .join(" "),
  E = (...e) => {
    C({ level: "info", message: T(e), timestamp: Date.now() });
  },
  S = (...e) => {
    C({ level: "warn", message: T(e), timestamp: Date.now() });
  },
  k = (...e) => {
    C({ level: "error", message: T(e), timestamp: Date.now() });
  },
  // v1.1.9.9: per-prompt output tracking. Google Vids lists generations oldest-first and
  // replaces each in-progress card with a finished card AT THE SAME POSITION. A prompt is
  // bound to its card's position, cross-checked against the prompt text on the finished
  // video (aria-label "Video được tạo: <prompt>") and de-duplicated by data-generation-id.
  ocCardSel = (e) =>
    e?.selectors?.outputCardItem ||
    'div[class*="VideogenerationthumbnailsContainer"] > div[class*="Container"]',
  ocVideoSel = 'video[class*="aiVideo"]',
  ocInProgressSel = 'div[class*="Inprogressvideogeneration"]',
  ocBoundCards = new WeakSet(),
  ocClaimedGens = new Set(),
  ocClaimedSrcs = new Set(),
  ocSrcOf = (e) => e.currentSrc || e.src || "",
  ocGenOf = (e) =>
    e?.getAttribute?.("data-generation-id") ||
    e?.querySelector?.("[data-generation-id]")?.getAttribute("data-generation-id") ||
    "",
  ocNorm = (e) => (e || "").toLowerCase().replace(/s+/g, " ").trim(),
  ocPromptMatches = (card, prompt) => {
    const label = ocNorm(
      card.querySelector("video")?.getAttribute("aria-label") || card.textContent,
    );
    const head = ocNorm(prompt).slice(0, 40);
    return !!head && label.includes(head);
  },
  ocCards = (cfg) => Array.from(s(ocCardSel(cfg))),
  ocIsInProgress = (card, cfg) =>
    s(card).is(ocInProgressSel) ||
    s(card).find(ocInProgressSel).length > 0 ||
    s(card).find(cfg.selectors.loadingOutputElement).length > 0,
  ocSnapshot = (cfg) => {
    const cards = ocCards(cfg);
    return {
      cards: new Set(cards),
      gens: new Set(cards.map(ocGenOf).filter(Boolean)),
      srcs: new Set(Array.from(s(ocVideoSel)).map(ocSrcOf).filter(Boolean)),
    };
  },
  ocLastFrame = async (src) => {
    if (!src) return null;
    let url = null;
    try {
      const blob =
        src instanceof Blob
          ? src
          : await (await fetch(src, { credentials: "include" })).blob();
      url = URL.createObjectURL(blob);
      const el = document.createElement("video");
      (el.muted = !0), (el.preload = "auto");
      return await new Promise((ok) => {
        const to = setTimeout(() => ok(null), 2e4);
        el.addEventListener(
          "loadedmetadata",
          () => (el.currentTime = Math.max(0, el.duration - 0.05)),
          { once: !0 },
        );
        el.addEventListener(
          "seeked",
          () => {
            clearTimeout(to);
            try {
              const c = document.createElement("canvas");
              (c.width = el.videoWidth), (c.height = el.videoHeight);
              c.getContext("2d").drawImage(el, 0, 0);
              ok(c.toDataURL("image/jpeg", 0.92));
            } catch {
              ok(null);
            }
          },
          { once: !0 },
        );
        el.addEventListener("error", () => (clearTimeout(to), ok(null)), {
          once: !0,
        });
        el.src = url;
      });
    } catch {
      return null;
    } finally {
      url && URL.revokeObjectURL(url);
    }
  },
  ocDescribe = (e) =>
    e.tagName.toLowerCase() +
    "." +
    Array.from(e.classList)
      .map((c) => c.replace("appsDocsAiGenerativeaiVideoUiSidebarWiz", "~"))
      .slice(0, 2)
      .join("."),
  // Waits for the card created by the send click: new since the snapshot, not finished yet
  // (finished cards carry a generation id), and not already bound to an earlier prompt.
  ocWaitNewCard = async (cfg, snap, isCancelled, timeoutMs = 3e4) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (isCancelled && isCancelled()) throw new Error("Cancelled");
      const cards = ocCards(cfg),
        fresh = cards.filter(
          (el) => !snap.cards.has(el) && !ocBoundCards.has(el) && !ocGenOf(el),
        );
      if (fresh.length > 0) {
        const card = fresh.find((el) => ocIsInProgress(el, cfg)) || fresh[0];
        if (fresh.length > 1)
          S(`⚠️ ${fresh.length} new output cards appeared, binding the in-progress one`);
        ocBoundCards.add(card);
        return { ocCard: card, index: cards.indexOf(card), preGens: snap.gens };
      }
      await f(500, isCancelled);
    }
    return null;
  },
  // Returns the card currently holding this prompt's generation, or null while unknown.
  ocResolveCard = (meta, cfg, prompt) => {
    if (meta.ocCard.isConnected) return meta.ocCard;
    const cards = ocCards(cfg),
      fresh = cards.filter((c) => {
        const g = ocGenOf(c);
        return g && !ocClaimedGens.has(g) && !meta.preGens.has(g);
      }),
      byPrompt = fresh.filter((c) => ocPromptMatches(c, prompt)),
      dist = (c) => Math.abs(cards.indexOf(c) - meta.index);
    let card = null;
    byPrompt.length > 0
      ? (card = byPrompt.reduce((a, c) => (dist(c) < dist(a) ? c : a)))
      : fresh.includes(cards[meta.index]) && (card = cards[meta.index]);
    card &&
      (cards.indexOf(card) !== meta.index &&
        S(`⚠️ Output card moved from #${meta.index} to #${cards.indexOf(card)}, matched by prompt text`),
      (meta.ocCard = card),
      (meta.index = cards.indexOf(card)));
    return card;
  },
  I = async (e, t, n) => {
    const r = [
      { name: "Redirect to Create", status: "pending" },
      { name: "Configure Video", status: "pending" },
      { name: "Fill Prompt", status: "pending" },
      { name: "Check & Download Resource", status: "pending" },
    ];
    try {
      if (
        (await (async () => {
          try {
            await chrome.runtime.sendMessage({ type: "CA" });
          } catch {}
        })(),
        E(
          "\ud83d\ude80 Starting Google Vids Automation - Step 1: Redirect to create page",
        ),
        (r[0].status = "running"),
        e.outputPreviousPrompt?.nextPromptEditImage)
      )
        E("\ud83d\udd0d Skipping redirect to create page");
      else if (
        window.location.href.includes("https://docs.google.com/videos/u/0/")
      ) {
        if (!(await A(n, t)))
          return (
            (r[0].status = "error"),
            (r[0].error = "Failed to redirect to create page"),
            {
              success: !1,
              steps: r,
              error: "Failed to redirect to create page",
            }
          );
        (r[0].status = "completed"),
          E("\u2705 Redirect to create page successfully");
      } else
        (r[0].status = "completed"),
          E(
            "\ud83d\udd0d URL does not include Google Vids home dashboard, skipping redirect to create page",
          );
      const o = n.selectors;
      if (
        (m(ocPick(o.dialogCloseButton)) &&
          (await v(o.dialogCloseButton, "Dialog close button", t),
          await f(600, t),
          m(ocPick(o.dialogCloseButton)) &&
            (S("⚠️ Dialog still open after click, retrying with synthetic click"),
            ocSynthClick(ocPick(o.dialogCloseButton).get(0)),
            await f(600, t))),
        e.mode.includes("ToVideo"))
      ) {
        E("\u23f3 Step 2: Configuring video..."), (r[1].status = "running");
        if (!(await j(e, t, n)))
          return (
            (r[1].status = "error"),
            (r[1].error = "Failed to configure video"),
            { success: !1, steps: r, error: "Failed to configure video" }
          );
        (r[1].status = "completed"), E("\u2705 Video configured");
      } else if (e.mode.includes("ToImage")) {
        E("\u23f3 Step 2: Configuring image..."), (r[1].status = "running");
        if (!(await N(e, t, n)))
          return (
            (r[1].status = "error"),
            (r[1].error = "Failed to configure image"),
            { success: !1, steps: r, error: "Failed to configure image" }
          );
        (r[1].status = "completed"), E("\u2705 Image configured");
      } else if (e.mode.includes("ToVoice")) {
        E("\u23f3 Step 2: Configuring voice..."), (r[1].status = "running");
        if (!(await R(e, t, n)))
          return (
            (r[1].status = "error"),
            (r[1].error = "Failed to configure voice"),
            { success: !1, steps: r, error: "Failed to configure voice" }
          );
        (r[1].status = "completed"), E("\u2705 Voice configured");
      }
      E("\u23f3 Step 3: Filling prompt..."), (r[2].status = "running");
      const ocSnap = e.mode.includes("ToVideo") ? ocSnapshot(n) : null;
      if (!(await $(e, n, t)))
        return (
          (r[2].status = "error"),
          (r[2].error = "Failed to fill prompt"),
          { success: !1, steps: r, error: "Failed to fill prompt" }
        );
      (r[2].status = "completed"),
        E("\u2705 Prompt filled"),
        E("\u23f3 Waiting for video generation to start..."),
        E("\u23f3 Step 4: Locating output container..."),
        (r[3].status = "running");
      const i = await _(e, t, n, ocSnap);
      return i.success
        ? ((r[3].status = "completed"),
          { success: !0, steps: r, outputContainer: i.outputContainer })
        : ((r[3].status = "error"),
          (r[3].error = "Could not find output container"),
          { success: !1, steps: r, error: "Could not find output container" });
    } catch (o) {
      return String(o).includes("Cancelled")
        ? (E("\u274c Automation cancelled"),
          { success: !1, steps: r, cancelled: !0, error: "Cancelled" })
        : (k("\u274c Automation failed:", o),
          { success: !1, steps: r, error: String(o) });
    }
  },
  A = async (e, t) => {
    try {
      E("Redirecting to create page...");
      const n = e.selectors;
      return (
        await v(n.createNewProjectButton, "Create new project", t, 1e4), !0
      );
    } catch (n) {
      if (String(n).includes("Cancelled")) throw n;
      return k("Error in redirectToCreatePage:", n), !1;
    }
  },
  D = async (e, t, n, r) => {
    const o = n.selectors;
    document.documentElement.setAttribute("data-vids-active", "true");
    try {
      const n = e.images?.[t];
      if (!n?.base64) return S(`No image base64 provided for index ${t}`), !1;
      const i = await y(o.uploadImageButton, r),
        a =
          !!(i && i.length > 0) &&
          (await (async (e, t, n) => {
            const r = e.getBoundingClientRect();
            if (0 === r.width || 0 === r.height)
              return S("Drop target has no size, cannot drop image"), !1;
            const o = r.left + r.width / 2,
              i = r.top + r.height / 2,
              s = document.elementFromPoint(o, i) || e,
              a = new DataTransfer();
            a.items.add(t), (a.effectAllowed = "all"), (a.dropEffect = "copy");
            const u = (e) =>
              s.dispatchEvent(
                new DragEvent(e, {
                  bubbles: !0,
                  cancelable: !0,
                  composed: !0,
                  clientX: o,
                  clientY: i,
                  screenX: window.screenX + o,
                  screenY: window.screenY + i,
                  dataTransfer: a,
                }),
              );
            return (
              u("dragenter"),
              await f(100, n),
              u("dragover"),
              await f(100, n),
              u("dragover"),
              await f(100, n),
              u("drop"),
              u("dragleave"),
              E(`\ud83d\udce5 Dropped image "${t.name}" on upload target`),
              !0
            );
          })(
            i[0],
            ((e, t) => {
              let n = "image/jpeg";
              const r = e.match(/^data:([^;]+);/);
              r && (n = r[1]);
              const o = e.includes(",") ? e.split(",")[1] : e,
                i = atob(o),
                s = new Uint8Array(i.length);
              for (let a = 0; a < i.length; a++) s[a] = i.charCodeAt(a);
              return new File([s], t, { type: n });
            })(n.base64, n.name),
            r,
          ));
      if (!a) {
        S(
          "Could not drop image on upload button, falling back to click upload",
        ),
          s(o.moreUploadButton).length > 0 &&
            (await v(o.moreUploadButton, "Click more upload button", r)),
          await v(o.uploadImageButton, "Click image upload button", r);
        const n = await (async (e, t) => {
          try {
            if (!e.images || 0 === e.images.length)
              return S("No images provided in config"), !1;
            if (t >= e.images.length || t < 0)
              return (
                S(
                  `Image index ${t} out of range. Total images: ${e.images.length}`,
                ),
                !1
              );
            const n = e.images[t];
            if (!n || !n.base64) return S("No image base64 provided"), !1;
            let r = "image/jpeg";
            if (n.base64.startsWith("data:")) {
              const e = n.base64.match(/^data:([^;]+);/);
              e && (r = e[1]);
            }
            const o = { base64: n.base64, filename: n.name, mimeType: r };
            return (
              document.dispatchEvent(
                new CustomEvent("VIDS_UPLOAD_FILE_DATA", { detail: o }),
              ),
              !0
            );
          } catch (n) {
            return k("Error in uploadImageFromBase64 event dispatch:", n), !1;
          }
        })(e, t);
        if (!n) return !1;
      }
      return (
        (!r || !r()) &&
        (E("Waiting for image upload to complete..."),
        await f(2e3, r),
        await (async (e, t, n = 3e4, r = 200) => {
          const o = Date.now();
          for (; Date.now() - o < n; ) {
            if (t && t()) throw new Error("Cancelled");
            const n = ocPick(e);
            if (!m(n)) return !0;
            await f(r, t);
          }
          return !1;
        })(o.imageUploading, r, 3e4),
        !0)
      );
    } finally {
      document.documentElement.removeAttribute("data-vids-active");
    }
  },
  j = async (e, t, n) => {
    if (!n) return !1;
    try {
      if (t && t()) return !1;
      const r = n.selectors;
      try {
        // Vids restores the Video AI panel on load while the rail button still reports
        // aria-pressed="false", so clicking on that attribute alone closed an open panel.
        // The visible prompt box is the source of truth.
        const ocPanelOpen = () =>
          m(ocPick('div[class*="promptTextAreaPromptRichTextInputContainer"]'));
        if (!ocPanelOpen()) {
          await v(
            "div#content-library-rail-video-generation-element",
            "Open Video AI panel",
            t,
            3e3,
          );
          for (let i = 0; i < 20 && !ocPanelOpen(); i++) await f(150, t);
        }
      } catch (err) {}
      try {
        m(ocPick(r.collapseVideoInput)) ||
          (await v(r.expandVideoInput, "Expand prompt box", t, 3e3));
      } catch (err) {}
      try {
        m(ocPick(r.clearInputButton)) &&
          (await v(r.clearInputButton, "Clear input button", t, 2e3));
      } catch (err) {}
      try {
        "imageToVideo" === e.mode || e.outputPreviousPrompt?.extractedFrame
          ? await v(r.frameToVideoModeButton, "Frame To Video", t, 3e3)
          : await v(r.textToVideoModeButton, "TextToVideo mode option", t, 3e3);
      } catch (err) {}
      const ocMenuOpen = () => m(ocPick(r.aspectRatioVideoLandscape));
      try {
        await v(r.configButton, "Open Configure Menu", t, 2e3);
        "16:9" === e.aspectRatio
          ? await v(r.aspectRatioVideoLandscape, "Select 16:9", t, 2e3)
          : "9:16" === e.aspectRatio &&
            (await v(r.aspectRatioVideoPortrait, "Select 9:16", t, 2e3));
        await v(r.videoQualityButton, "Video Quality Button", t, 2e3);
        "1080p" === e.autoDownloadResourceQuality
          ? await v(r.videoQuality1080pItem, "Video Quality 1080p", t, 2e3)
          : await v(r.videoQuality720pItem, "Video Quality 720p", t, 2e3);
      } catch (err) {
        S("⚠️ Video settings step failed:", String(err));
      }
      try {
        await f(300, t);
        ocMenuOpen() && (await v(r.configButton, "Close Configure Menu", t, 2e3));
      } catch (err) {}
      await f(500, t);
      if (
        (e.outputPreviousPrompt?.extractedFrame &&
          (e.images || (e.images = []),
          e.images.unshift({
            base64: e.outputPreviousPrompt.extractedFrame,
            name: `extracted-frame-${Date.now()}.jpg`,
          }),
          E("✅ Last frame from previous prompt injected as first image")),
        e.images && e.images.length > 0)
      )
        for (let i = 0; i < e.images.length; i++) {
          E(
            `Uploading image ${i + 1}/${e.images.length}: ${e.images[i].name}...`,
          );
          if (!(await D(e, i, n, t)))
            return S(`❌ Failed to upload image ${i + 1}, stop...`), !1;
          E(`✅ Image ${i + 1} uploaded successfully`);
        }
      return !0;
    } catch (r) {
      return k("Error in configureVideo:", r), !0;
    }
  },
  N = async (e, t, n) => {
    if (!n) return !1;
    try {
      if (t && t()) return !1;
      const r = n.selectors,
        o = await y(r.imageModeItem, t);
      o && o.length > 0 && (await v(r.imageModeItem, "Image Mode", t));
      const i = r.aspectRatioImageSelectedTemplate.replace(
        "{aspectRatio}",
        e.aspectRatio,
      );
      if (s(r.aspectRatioImageButton).length > 0 && 0 == s(i).length) {
        await v(r.aspectRatioImageButton, "Select Aspect Ratio Mode", t);
        const n = r.aspectRatioImageTemplate.replace(
          "{aspectRatio}",
          e.aspectRatio,
        );
        E("Looking for aspect ratio:", e.aspectRatio);
        const o = await y(n, t);
        o && o.length > 0
          ? await v(n, `Aspect ratio option: ${e.aspectRatio}`, t)
          : S(`\u274c Could not find aspect ratio option: ${e.aspectRatio}`);
      }
      if ((await f(1e3, t), e.images && e.images.length > 0))
        for (let s = 0; s < e.images.length; s++) {
          E(
            `Uploading image ${s + 1}/${e.images.length}: ${e.images[s].name}...`,
          );
          (await D(e, s, n, t))
            ? E(`\u2705 Image ${s + 1} uploaded successfully`)
            : S(`\u274c Failed to upload image ${s + 1}, but continuing...`);
        }
      else
        S("\u274c No images provided for ImageToVideo/ComponentsToVideo mode");
      return !0;
    } catch (r) {
      return k("Error in configureImage:", r), !1;
    }
  },
  R = async (e, t, n) => {
    if (!n) return !1;
    try {
      if (t && t()) return !1;
      const e = n.selectors,
        r = await y(e.voiceModeItem, t);
      return (
        r && r.length > 0 && (await v(e.voiceModeItem, "Voice Mode", t)),
        await f(1e3, t),
        !0
      );
    } catch (r) {
      return k("Error in configureVoice:", r), !1;
    }
  },
  P = async (e, t, n) => {
    const r = e.images,
      o =
        void 0 !== t
          ? [{ image: r[t], i: t }]
          : r.map((e, t) => ({ image: e, i: t }));
    E(`\ud83c\udfaf Selecting ${o.length} reference image(s) via @ mention...`);
    for (const { image: i, i: s } of o) {
      await g("@", "Digit2", 50), await f(500, n);
      for (let e = 0; e < s; e++)
        await g("ArrowDown", "ArrowDown", 40), await f(150, n);
      await g("Enter", "Enter", 13),
        E(`\u2705 Typed @ and selected image ${s + 1}: ${i.name}`),
        await f(300, n);
    }
    await f(300, n);
  },
  $ = async (e, t, n) => {
    try {
      const r = t.selectors;
      E("\ud83d\udcdd Starting to fill prompt...");
      let o = r.videoInput;
      e.mode.includes("ToImage")
        ? (o = r.imageInput)
        : e.mode.includes("ToVoice") && (o = r.voiceInput);
      let i = await y(o, n, 5e3);
      if (!i || 0 === i.length) {
        const fbSel =
          'div[class*="promptTextAreaPromptRichTextInputContainer"], div[class*="RichTextInputContentEditableContainer"], div[contenteditable="true"]';
        i = await y(fbSel, n, 3e3);
        if (i && i.length > 0) o = fbSel;
      }
      if (!i || 0 === i.length)
        return k(`Could not find prompt element with selector: ${o}`), !1;
      await v(o, "Prompt textarea", n), await f(500, n);
      try {
        const ocBox = ocPick(o).get(0),
          ocEditable =
            ocBox?.matches?.('[contenteditable="true"]')
              ? ocBox
              : ocBox?.querySelector?.('[contenteditable="true"]') || ocBox;
        ocEditable?.focus?.();
      } catch (err) {}
      const ocSelAll = !ocDomInput && (await g("a", "KeyA", 65, 2));
      await f(300, n);
      const ocBack = !ocDomInput && (await g("Backspace", "Backspace", 8));
      await f(200, n);
      // Debugger keys unavailable (e.g. another debugger attached): clear via editing commands,
      // otherwise the new prompt is appended to the previous one (Vids keeps the old text).
      if (!ocSelAll || !ocBack)
        try {
          document.execCommand("selectAll"),
            document.execCommand("delete"),
            await f(200, n);
        } catch (err) {}
      if (
        !!e.images &&
        e.images.length > 0 &&
        "imageToVideo" !== e.mode &&
        !e.outputPreviousPrompt?.extractedFrame &&
        !e.mode.includes("ToVoice")
      ) {
        const t = ((e, t) => {
          const n = [];
          if (!t || 0 === t.length || !e) return n;
          for (let i = 0; i < t.length; i++) {
            const r = t[i];
            if (!r.name) continue;
            const o = r.name.lastIndexOf("."),
              s = -1 !== o ? r.name.substring(0, o) : r.name;
            if (!s) continue;
            const a = s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),
              u = /^\w/.test(s) && /\w$/.test(s),
              c = new RegExp(u ? `\\b${a}\\b` : a, "gi");
            let l;
            for (; null !== (l = c.exec(e)); )
              n.push({ index: l.index, length: l[0].length, imageIndex: i });
          }
          n.sort((e, t) => e.index - t.index);
          const r = [];
          let o = 0;
          for (const i of n)
            i.index >= o && (r.push(i), (o = i.index + i.length));
          return r;
        })(e.prompt, e.images);
        if (t.length > 0) {
          E(
            `\ud83d\udca1 Found ${t.length} inline image match(es) in prompt. Typing inline...`,
          );
          let r = 0;
          for (const o of t) {
            const t = e.prompt.substring(r, o.index + o.length);
            t && (await h(t), await f(100, n)),
              await h(" "),
              await f(100, n),
              await P(e, o.imageIndex, n),
              (r = o.index + o.length);
          }
          r < e.prompt.length &&
            (await h(e.prompt.substring(r)), await f(100, n));
        } else await P(e, void 0, n), await h(e.prompt);
      } else await h(e.prompt);
      try {
        const pe = s(o).get(0);
        if (pe) {
          pe.dispatchEvent(new Event("input", { bubbles: !0, composed: !0 }));
          pe.dispatchEvent(new Event("change", { bubbles: !0 }));
        }
      } catch (err) {}
      await f(400, n);
      let btnClicked = !1;
      try {
        if (e.mode.includes("ToVideo")) {
          // Precise selector owned by the content script: broad aria-label "Tạo"/"Create"
          // selectors from remote config also match the welcome dialog and rail buttons.
          await v(
            'button[data-idom-class*="collapsiblePromptBoxGenerateButton"], button[class*="collapsiblePromptBoxGenerateButton"]',
            "Send button",
            n,
            4e3,
          );
          btnClicked = !0;
        } else if (e.mode.includes("ToImage")) {
          await v(r.sendImageButton, "Send button", n, 4e3);
          btnClicked = !0;
        } else if (e.mode.includes("ToVoice")) {
          await v(r.sendVoiceButton, "Send button", n, 4e3);
          btnClicked = !0;
        }
      } catch (errBtn) {
        const fallbackSels = [
          'button[data-idom-class*="collapsiblePromptBoxGenerateButton"]',
          'button[class*="collapsiblePromptBoxGenerateButton"]',
          'button[data-idom-class*="collapsiblePromptBoxSubmitButton"]',
          'div[class*="GenerateMediaCardPrimaryActionButtonContainer"] button',
          'button[class*="promptTextAreaMenuBarGenerateButton"]',
        ];
        for (const sel of fallbackSels) {
          const bEl = ocPick(sel).get(0);
          if (bEl && m(s(bEl))) {
            try {
              bEl.scrollIntoView({
                block: "center",
                inline: "center",
                behavior: "instant",
              });
            } catch (err) {}
            try {
              bEl.focus();
            } catch (err) {}
            await ocClickOnce(bEl);
            btnClicked = !0;
            await f(300, n);
            break;
          }
        }
        if (!btnClicked) {
          try {
            await g("Enter", "Enter", 13);
          } catch (err) {}
        }
      }
      E(`\u2705 Filled prompt: ${e.prompt.substring(0, 50)}...`);
      await f(2e3, n);
      s(r.sendConfirmAnywayButton).length > 0 &&
        (await v(r.sendConfirmAnywayButton, "Dialog confirm button", n));
      return !0;
    } catch (r) {
      if (String(r).includes("Cancelled")) throw r;
      return k("Error in fillVidsPrompt:", r), !1;
    }
  },
  _ = async (e, t, n, ocSnap) => {
    if (!n) return { success: !1, outputContainer: [] };
    const r = n.selectors,
      ocCfg = n;
    try {
      if (ocSnap) {
        const meta = await ocWaitNewCard(ocCfg, ocSnap, t);
        if (meta)
          return (
            E(
              `🔗 Prompt ${e.promptIndex} bound to output card #${meta.index}: ${ocDescribe(meta.ocCard)}`,
            ),
            { success: !0, outputContainer: [meta] }
          );
        if (t && t()) return { success: !1, outputContainer: [] };
        S(
          `⚠️ Prompt ${e.promptIndex}: no new output card found (${ocCardSel(ocCfg)}), ` +
            "falling back to sequential mode for this prompt",
        );
        return {
          success: !0,
          outputContainer: [{ ocFallback: !0, excludeSrcs: ocSnap.srcs }],
        };
      }
      let n = 0;
      const o = 120;
      for (; n < o; ) {
        if (t && t()) return { success: !1, outputContainer: [] };
        let i = r.latestOutputContainer;
        e.mode.includes("ToVoice") && (i = r.latestOutputVoiceContainer);
        const s = await y(i, t, 5e3);
        if (s && s.length > 0)
          return { success: !0, outputContainer: [r.latestOutputContainer] };
        E(`\u23f3 Waiting for output container... attempt ${n + 1}/${o}`),
          n++,
          await f(500);
      }
      return { success: !1, outputContainer: [] };
    } catch (o) {
      return (
        k("Error in waitForOutputContainer:", o),
        { success: !1, outputContainer: [] }
      );
    }
  },
  M = async (t, n, r, o) => {
    if (!o) return { success: !1 };
    o.selectors;
    try {
      const u = await (async (e, t, n, r) => {
        if (!r)
          return {
            success: !1,
            resourceElements: [],
            outputContainerError: [],
          };
        const o = r.selectors;
        E("\u23f3 Step 4: Checking video generation status..."),
          E(
            `\u23f3 Waiting for resource to be generated for prompt: "${t.prompt.substring(0, 50)}..."`,
          );
        let i = [],
          a = 0;
        const ocMeta = e[0]?.ocCard ? e[0] : null,
          ocExclude = e[0]?.excludeSrcs || null;
        for (; a < 150 && e.length > 0; ) {
          if (n && n())
            return (
              E("\u274c Download cancelled"),
              { success: !1, resourceElements: [], outputContainerError: [] }
            );
          const ocCard = ocMeta ? ocResolveCard(ocMeta, r, t.prompt) : null,
            ocScoped = !!ocCard;
          let e = ocScoped
            ? s(ocCard)
            : ocMeta
              ? s()
              : s(o.latestOutputContainer);
          if (
            (t.mode.includes("ToVoice") &&
              (e = s(o.latestOutputVoiceContainer)),
            ocMeta
              ? !ocCard || ocIsInProgress(ocCard, r)
              : s(o.loadingOutputElement).length > 0)
          ) {
            let n = 0;
            const r = e.find(o.videoProgressBar);
            if (r.length > 0) {
              const e = r
                .text()
                .trim()
                .match(/(\d+)%/);
              e && (n = parseInt(e[1], 10));
            }
            E(`\u23f3 Attempt ${a + 1} - Resource is generating (${n}%)...`);
            try {
              chrome.runtime
                .sendMessage({
                  type: "VIDEO_GENERATION_PROGRESS",
                  data: {
                    groupId: t.groupId,
                    promptIndex: t.promptIndex,
                    percentage: n,
                    status: "generating",
                    prompt: t.prompt,
                  },
                })
                .catch(() => {});
            } catch {}
            a++;
          } else if (e.length > 0) {
            t.mode.includes("ToVoice") &&
              (await v(o.playMediaButton, "Play audio button", n),
              await f(4e3, n),
              s(o.playMediaButton).length > 0 &&
                (await v(o.playMediaButton, "Pause audio button", n)));
            const r = t.mode.includes("ToImage")
              ? Array.from(e.find('img[class*="image-synthesis-item"]:last()'))
              : t.mode.includes("ToVoice")
                ? Array.from(e.find("video:last()"))
                : Array.from(e.find(ocVideoSel))
                    .filter((e) => {
                      const t = ocSrcOf(e);
                      return (
                        !!t &&
                        !ocClaimedSrcs.has(t) &&
                        !(!ocScoped && ocExclude && ocExclude.has(t))
                      );
                    })
                    .slice(0, 1);
            if (r.length > 0 && r[0].src) {
              t.mode.includes("ToVideo") && ocClaimedSrcs.add(ocSrcOf(r[0])),
                ocScoped && ocClaimedGens.add(ocGenOf(ocCard));
              E(`\u2705 Found ${r.length} resource(s), no progress - done`);
              const e = t.isConcat ? 1 : Math.min(t.outputCount, r.length);
              (i = r.slice(0, e)),
                E(
                  `\ud83d\udce6 Limiting resources: isConcat=${t.isConcat}, outputCount=${t.outputCount}, found=${r.length}, will use=${i.length}`,
                );
              try {
                chrome.runtime
                  .sendMessage({
                    type: "VIDEO_GENERATION_PROGRESS",
                    data: {
                      groupId: t.groupId,
                      promptIndex: t.promptIndex,
                      percentage: 100,
                      status: "completed",
                      prompt: t.prompt,
                    },
                  })
                  .catch(() => {});
              } catch {}
              break;
            }
          } else
            E(`\u23f3 Attempt ${a + 1} - Container not found...`), (a += 10);
          await f(2e3, n), a++;
        }
        return 0 === i.length
          ? (S("Could not find any resource elements with src after waiting"),
            { success: !1, resourceElements: [], outputContainerError: [] })
          : { success: !0, resourceElements: i, outputContainerError: [] };
      })(t, n, r, o);
      if (!u.success)
        return (
          S(
            `\u274c Prompt generation failed for prompt ${n.promptIndex}, skipping download`,
          ),
          { success: !1, error: "Prompt generation failed" }
        );
      const c = u.outputContainerError || [];
      if (0 === t.filter((e) => !c.includes(e)).length)
        return (
          S(
            `\u274c All output containers have warning for prompt ${n.promptIndex}, need retry`,
          ),
          { success: !1 }
        );
      c.length > 0 &&
        E(
          `\u274c Filtered ${c.length} error output container(s) for prompt ${n.promptIndex}: [${c.join(", ")}]`,
        );
      let ocLastBlob = null;
      const l = async () => {
        if (n.isConcat && n.mode.includes("ToVideo")) {
          E("🔍 Extracting last frame from video elements...");
          // The page's <video> is cross-origin (usercontent.google.com), so drawing it taints
          // the canvas. Decode the same-origin blob we fetched instead; works in hidden tabs.
          const e =
            (await ocLastFrame(ocLastBlob || u.resourceElements[0]?.src)) ||
            (await x(u.resourceElements));
          return e
            ? { nextPromptExtendVideo: !0, extractedFrame: e }
            : (S(
                "⚠️ Could not extract the last frame, the next prompt will start without it",
              ),
              {});
        }
        return {};
      };
      if (
        (n.mode.includes("ToVoice") || e(n, u.resourceElements),
        "no-download" === n.autoDownloadResourceQuality)
      )
        return (
          E(
            `\ud83d\udd0d Skipping download for prompt ${n.promptIndex} (no-download)`,
          ),
          { success: !0, ...(await l()) }
        );
      const d = String(n.promptIndex).padStart(3, "0");
      if (n.mode.includes("ToVideo") || n.mode.includes("ToVoice")) {
        const e = u.resourceElements,
          t = "abcdefghijklmnopqrstuvwxyz".split(""),
          o = n.mode.includes("ToVoice"),
          s = o ? "mp3" : "mp4";
        E(
          `\ud83d\udce5 Downloading ${e.length} ${o ? "audio" : "video"}(s) for prompt ${n.promptIndex}...`,
        );
        for (let a = 0; a < e.length; a++) {
          const u = e[a].src;
          if (u)
            try {
              let e = u;
              if (u.startsWith("blob:") || u.startsWith("http")) {
                const t = await fetch(u, { credentials: "include" }),
                  n = await t.blob();
                ocLastBlob = n;
                (e = await new Promise((e, t) => {
                  const r = new FileReader();
                  (r.onload = () => e(r.result)),
                    (r.onerror = t),
                    r.readAsDataURL(n);
                })),
                  o &&
                    e.startsWith("data:") &&
                    (e = e.replace(/^data:[^;]+;/, "data:audio/mpeg;"));
              }
              const i = t[a] || `_${a + 1}`,
                c = `${d}_${w(n.prompt)}_${i}.${s}`,
                l = await chrome.runtime
                  .sendMessage({
                    type: "DOWNLOAD_RESOURCE",
                    url: e,
                    filename: c,
                    folder: n.folderName?.trim() || "",
                    autoChangeFileName: !1 !== n.autoChangeFileName,
                  })
                  .then((e) => e || { success: !1, error: "No response" })
                  .catch((e) => ({ success: !1, error: String(e) }));
              l?.success
                ? E(`\u2705 ${o ? "Audio" : "Video"} downloaded: ${c}`)
                : S(
                    `\u26a0\ufe0f ${o ? "Audio" : "Video"} download failed: ${l?.error ?? "unknown"}`,
                  ),
                await f(500, r);
            } catch (i) {
              if (String(i).includes("Cancelled")) throw i;
              S(
                `\u26a0\ufe0f Error downloading ${o ? "audio" : "video"} ${a + 1}:`,
                i,
              );
            }
          else
            S(
              `\u26a0\ufe0f ${o ? "Audio" : "Video"} ${a + 1} has no src, skipping...`,
            );
        }
        return { success: !0, ...(await l()) };
      }
      const p = `${d}_${w(n.prompt)}_`,
        h = n.folderName.trim();
      chrome.runtime.sendMessage({
        type: "SET_FOLDER_NAME",
        folderName: h,
        prefix: p,
        autoChangeFileName: !1 !== n.autoChangeFileName,
      }),
        E(`\u2705 Download folder set: ${h || "(default)"}, prefix: ${p}`),
        E(
          `\ud83d\udd0d Starting to download ${u.resourceElements.length} image(s) for prompt ${n.promptIndex}...`,
        );
      const g = "abcdefghijklmnopqrstuvwxyz".split("");
      for (let e = 0; e < u.resourceElements.length; e++) {
        const t = u.resourceElements[e].src;
        if (!t) {
          S(`\u274c Resource ${e + 1} has no src, skipping...`);
          continue;
        }
        const o = g[e] || `_${e + 1}`;
        E(
          `\ud83d\udd0d Resource ${n.promptIndex}${o}: ${t.substring(0, 100)}...`,
        );
        try {
          const e = !1 !== n.autoChangeFileName;
          let i, s;
          if (e) {
            const e = w(n.prompt);
            (i = `${d}_${e}.${"jpg"}`), (s = n.folderName.trim());
          } else {
            (i =
              new URL(t).pathname.split("/").pop() || `${d}_resource_${o}.jpg`),
              (s = "");
          }
          const a = await chrome.runtime
            .sendMessage({
              type: "DOWNLOAD_RESOURCE",
              url: t,
              filename: i,
              folder: s,
              autoChangeFileName: e,
            })
            .then(
              (e) =>
                e || {
                  success: !1,
                  error: "No response from background script",
                },
            )
            .catch((e) => ({ success: !1, error: e.message || String(e) }));
          if (!a.success)
            throw new Error(a.error || "Failed to initiate download");
          E(
            `\u2705 Resource ${n.promptIndex}${o} downloaded successfully: ${i}`,
          ),
            await f(500, r);
        } catch (a) {
          if (String(a).includes("Cancelled")) throw a;
          k(`\u274c Error downloading resource ${n.promptIndex}${o}:`, a);
        }
      }
      return (
        E("\u2705 All resources downloaded successfully"),
        { success: !0, ...(await l()) }
      );
    } catch (u) {
      return String(u).includes("Cancelled")
        ? (E("\u274c Download cancelled"),
          { success: !1, cancelled: !0, error: "Cancelled" })
        : (k("Error in downloadFromOutputContainer:", u),
          { success: !1, error: String(u) });
    }
  };
function O(e, t) {
  if (0 === t) return !0;
  const n = t - 1;
  if (e.payloads[t - 1].isConcat) {
    const t = e.completedPromptIndexes.has(n);
    return t;
  }
  return !0;
}
function L(e, t) {
  for (let n = 0; n < e.pendingIndexes.length; n++) {
    const t = e.pendingIndexes[n];
    if (O(e, t)) return e.pendingIndexes.splice(n, 1), t;
  }
  return null;
}
const q = (e) => ocSleep(e);
async function F(e, t, n, r) {
  Math.random().toString(36).slice(2, 6);
  for (;;) {
    if (e.isCancelling) return;
    if (e.processedCount >= e.totalCount) return;
    // In-flight = submitted prompts whose result has not been downloaded yet. Only prompts
    // bound to their own output card may overlap; anything else must finish first.
    const ocInflight = n.filter((t) => t.id === e.id),
      ocLimit = ocInflight.some((t) => t.items.some((e) => !e.bound))
        ? 1
        : Math.max(1, Math.min(10, e.concurrentPrompts || 1));
    if (ocInflight.length >= ocLimit) {
      await q(500);
      continue;
    }
    const i = L(e);
    if (null === i) {
      if (e.processedCount >= e.totalCount) return;
      await q(500);
      continue;
    }
    const s = e.payloads[i] || {},
      a = { ...s },
      u = a.promptIndex,
      c = e.promptDelaySecondsMin ?? 0,
      l = e.promptDelaySecondsMax ?? c;
    if (i > 0 && l > 0) {
      const t = c >= l ? c : c + Math.random() * (l - c);
      let n = 0;
      for (; n < 1e3 * t; )
        if ((await q(1e3), (n += 1e3), e.isCancelling)) return;
    }
    try {
      const o = e.retryCountByIndex[i] || 0;
      (e.currentPromptIndex = i), r(e);
      const c = await I(a, () => !!e.isCancelling, t);
      if (((e.currentPromptIndex = void 0), !c.success && !c.cancelled)) {
        if (o < (a.maxRetries ?? 5)) {
          (e.currentPromptIndex = void 0),
            (e.retryCountByIndex[i] = (e.retryCountByIndex[i] || 0) + 1);
          e.retryCountByIndex[i];
          e.pendingIndexes.includes(i) || e.pendingIndexes.unshift(i), r(e);
          continue;
        }
      }
      if (
        (e.completedPromptIndexes.add(i),
        e.results.push({
          index: i,
          promptIndex: u,
          success: c.success,
          downloadComplete: !1,
          steps: c.steps,
          error: c.error,
          cancelled: !!e.isCancelling,
        }),
        c.success && c.outputContainer && c.outputContainer.length > 0)
      ) {
        const t = (e.downloadRetryCountByIndex || {})[i] || 0,
          r = {
            outputContainer: c.outputContainer,
            config: { ...s },
            promptIndex: s.promptIndex,
            index: i,
            retryCount: t,
            bound: !!c.outputContainer[0]?.ocCard,
          };
        e.downloadItems.push(r),
          n.push({
            id: e.id,
            items: [r],
            status: "queued",
            isCancelling: !!e.isCancelling,
          });
      }
      if (((e.processedCount += 1), r(e), c.success, e.isCancelling)) return;
    } catch (o) {
      if (
        ((e.currentPromptIndex = void 0),
        e.completedPromptIndexes.add(i),
        e.results.push({
          index: i,
          promptIndex: u,
          success: !1,
          downloadComplete: !0,
          error: o instanceof Error ? o.message : "Unknown error",
        }),
        (e.processedCount += 1),
        r(e),
        e.isCancelling)
      )
        return;
    }
  }
}
function H(e, t, n, r) {
  const o = n.find((e) => e.id === t);
  if (!o) return;
  const i = e.index ?? e.config?.promptIndex ?? 0,
    s = o.results.find((e) => e.index === i);
  s && (s.downloadComplete = !0), r(o);
}
function B(e, t, n, r, o) {
  const i = e.index ?? e.config?.promptIndex ?? 0,
    s = n.find((e) => e.id === t);
  s &&
    ((s.results = s.results.filter((e) => e.index !== i)),
    s.results.push({
      index: i,
      promptIndex: e.config?.promptIndex ?? i,
      success: !1,
      downloadComplete: !0,
      error: o || "Download failed",
    }),
    r(s));
}
function W(e, t, n, r) {
  const o = e.config?.maxRetries ?? 5,
    i = e.retryCount ?? 0,
    s = e.index ?? e.config?.promptIndex ?? 0,
    a = n.find((e) => e.id === t);
  if (i < o && a && "running" === a.status)
    return (
      (a.downloadRetryCountByIndex = a.downloadRetryCountByIndex || {}),
      (a.downloadRetryCountByIndex[s] =
        (a.downloadRetryCountByIndex[s] || 0) + 1),
      (a.results = a.results.filter((e) => e.index !== s)),
      a.completedPromptIndexes.delete(s),
      (a.processedCount = Math.max(0, a.processedCount - 1)),
      a.pendingIndexes.includes(s) || a.pendingIndexes.unshift(s),
      void r(a)
    );
  a &&
    ((a.results = a.results.filter((e) => e.index !== s)),
    a.results.push({
      index: s,
      promptIndex: e.config?.promptIndex ?? s,
      success: !1,
      downloadComplete: !0,
      error: `Exceeded maxRetries (${o})`,
    }),
    a.completedPromptIndexes.add(s),
    r(a));
}
const V = (e) => ocSleep(e),
  U = [],
  z = [];
let G = null;
const X = (e) => {
    ocTrackZoom(e);
    try {
      chrome.runtime
        .sendMessage({ type: "SET_ZOOM", zoomFactor: e })
        .catch(() => {});
    } catch {}
  },
  Q = (e) => {
    try {
      chrome.runtime
        .sendMessage({
          type: "PROMPT_GROUP_STATUS",
          data: {
            id: e.id,
            status: e.status,
            processedCount: e.processedCount,
            totalCount: e.totalCount,
            createdAt: e.createdAt,
            isCancelling: !!e.isCancelling,
            isActive: G === e.id,
            delayRemainingSeconds: e.delayRemainingSeconds,
            results: e.results.map((e) => ({
              index: e.index,
              promptIndex: e.promptIndex,
              success: e.success,
              downloadComplete: e.downloadComplete,
              error: e.error,
            })),
            currentPromptIndex: e.currentPromptIndex,
            promptPreviews: e.payloads.map((e) =>
              (e?.prompt || "").toString().substring(0, 60),
            ),
            promptIndices: e.payloads.map((e) => e.promptIndex),
            retryCountByIndex: { ...e.retryCountByIndex },
            downloadRetryCountByIndex: {
              ...(e.downloadRetryCountByIndex || {}),
            },
          },
        })
        .catch(() => {});
    } catch {}
  };
async function Y(e) {
  const t = await chrome.runtime
    .sendMessage({ type: "GET_REMOTE_CONFIG" })
    .then((e) => e ?? null)
    .catch(() => null);
  if (!t)
    return (
      (e.status = "error"),
      Q(e),
      U.shift(),
      e.sendResponse({
        success: !1,
        error: "Cannot connect to server. Extension may be unauthorized.",
        results: [],
      }),
      (G = null),
      void X(1)
    );
  for (;;) {
    if (e.isCancelling) {
      e.status = "cancelled";
      const t = e.results;
      return (
        U.shift(),
        Q(e),
        e.sendResponse({ success: !1, cancelled: !0, results: t }),
        (G = null),
        void X(1)
      );
    }
    // A single submitter: the page has one prompt box, so parallel submitters overwrite
    // each other's text and uploads. Parallelism comes from Google rendering several
    // submitted prompts at once (bounded by concurrentPrompts inside F).
    e.pendingIndexes.length > 0 && (await F(e, t, z, Q).catch((e) => {}));
    for (; z.some((t) => t.id === e.id); ) await V(200);
    if (0 === e.pendingIndexes.length) {
      e.status = "completed";
      const t = e.results.every((e) => e.success),
        n = e.results;
      return (
        U.shift(),
        Q(e),
        e.sendResponse({ success: t, results: n }),
        (G = null),
        void X(1)
      );
    }
  }
}
const J = "/assets/catchUploadFile.ts-DSScj7vH.js";
(() => {
  const e = document.createElement("script");
  (e.src = chrome.runtime.getURL(J)),
    (e.type = "module"),
    (document.head || document.documentElement).appendChild(e),
    e.remove();
})();
try {
  chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_RESET" }).catch(() => {});
} catch {}
(self.onerror = function (e, t, n, r, o) {}),
  b() &&
    (ocTrackZoom(0.8),
    chrome.runtime.sendMessage({ type: "SET_ZOOM", zoomFactor: 0.8 }));
const K = {},
  Z = {};
function ee(e, t) {
  const {
    payloads: n,
    groupId: r,
    concurrentPrompts: o,
    promptDelaySecondsMin: i,
    promptDelaySecondsMax: s,
  } = e;
  ((e, t, n, r, o, i) => {
    const s =
        t || `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      a = {
        id: s,
        payloads: e.map((e) => ({ ...e, groupId: s })),
        concurrentPrompts: n || 2,
        promptDelaySecondsMin: r || 0,
        promptDelaySecondsMax: o || 0,
        sendResponse: i,
        status: "queued",
        createdAt: Date.now(),
        processedCount: 0,
        totalCount: e.length,
        isCancelling: !1,
        results: [],
        pendingIndexes: e.map((e, t) => t),
        completedPromptIndexes: new Set(),
        retryCountByIndex: {},
        downloadRetryCountByIndex: {},
        downloadItems: [],
      };
    U.push(a), Q(a);
  })(
    n.map((e) => {
      if (e.imageIds && Array.isArray(e.imageIds)) {
        const t = e.imageIds.map((e) => K[e]).filter(Boolean);
        return { ...e, images: t };
      }
      return e;
    }),
    r,
    o,
    i,
    s,
    t,
  ),
    t({ success: !0 });
}
chrome.runtime.onMessage.addListener((e, t, n) => {
  switch (e.type) {
    case "PREPARE_IMAGE":
      return (
        (function (e, t) {
          const { id: n, data: r } = e;
          n && r
            ? ((K[n] = r), t({ success: !0 }))
            : t({ success: !1, error: "Missing image ID or data" });
        })(e, n),
        !0
      );
    case "PREPARE_IMAGE_CHUNK":
      return (
        (function (e, t) {
          const { id: n, chunk: r, chunkIndex: o, totalChunks: i } = e,
            s = `img-${n}`;
          Z[s] ||
            (Z[s] = { chunks: Array(i).fill(""), totalChunks: i, options: {} });
          const a = Z[s];
          a.chunks[o] = r;
          const u = a.chunks.filter((e) => "" !== e).length;
          if (u === i)
            try {
              const e = JSON.parse(a.chunks.join(""));
              (K[n] = e), delete Z[s], t({ success: !0 });
            } catch (c) {
              t({ success: !1, error: "Failed to parse image chunks" });
            }
          else
            t({
              success: !0,
              chunkReceived: !0,
              receivedCount: u,
              totalChunks: i,
            });
        })(e, n),
        !0
      );
    case "AUTO_FILL_VIDS":
      return ee(e, n), !0;
    case "CANCEL_PROMPT_GROUP":
      return (
        n(
          ((e) => {
            const t = U.findIndex((t) => t.id === e);
            if (-1 === t)
              return { success: !1, error: "Prompt group not found" };
            const n = U[t];
            return "queued" === n.status
              ? ((n.status = "cancelled"),
                U.splice(t, 1),
                Q(n),
                n.sendResponse({ success: !1, cancelled: !0, results: [] }),
                { success: !0, cancelled: !0 })
              : "running" === n.status
                ? ((n.isCancelling = !0),
                  Q(n),
                  z
                    .filter((t) => t.id === e)
                    .forEach((e) => (e.isCancelling = !0)),
                  { success: !0, cancelling: !0 })
                : { success: !1, error: "Prompt group is already finished" };
          })(e.groupId),
        ),
        !0
      );
    case "CHECK_VIDS_PAGE":
      return n({ isVidsPage: b() }), !0;
    case "CREATE_NEW_PROJECT":
      return (
        (async function (e, t) {
          try {
            const e = await chrome.runtime.sendMessage({
              type: "GET_REMOTE_CONFIG",
            });
            const n = e?.selectors;
            if (n?.createNewProjectButton) {
              try {
                await v(
                  n.createNewProjectButton,
                  "Create new project",
                  void 0,
                  5e3,
                );
                return void t({ success: !0 });
              } catch (err) {}
            }
            window.location.href = "https://docs.google.com/videos/create";
            t({ success: !0 });
          } catch (n) {
            window.location.href = "https://docs.google.com/videos/create";
            t({ success: !0 });
          }
        })(0, n),
        !0
      );
    default:
      return !0;
  }
}),
  (async () => {
    for (;;) {
      if (0 === U.length) {
        await V(1e3);
        continue;
      }
      const t = U[0];
      if (t)
        if ("cancelled" !== t.status) {
          (G = t.id), (t.status = "running"), Q(t), X(0.5);
          try {
            await Y(t);
          } catch (e) {
            (t.status = "error"),
              Q(t),
              t.sendResponse({
                success: !1,
                error: e instanceof Error ? e.message : "Unknown error",
              }),
              X(1);
          }
        } else
          U.shift(),
            Q(t),
            t.sendResponse({ success: !1, cancelled: !0, results: [] });
    }
  })(),
  (async () => {
    for (;;) {
      if (0 === z.length) {
        await V(1e3);
        continue;
      }
      const e = z[0];
      if (!e) continue;
      e.status = "running";
      const t = await chrome.runtime
        .sendMessage({ type: "GET_REMOTE_CONFIG" })
        .then((e) => e ?? null)
        .catch(() => null);
      if (t) {
        for (const n of e.items) {
          if (e.isCancelling) break;
          const r = await M(
            n.outputContainer,
            n.config,
            () => e.isCancelling,
            t,
          );
          if (r.success) {
            if (
              void 0 !== r.nextPromptExtendVideo ||
              void 0 !== r.nextPromptEditImage ||
              void 0 !== r.extractedFrame
            ) {
              const t = U.find((t) => t.id === e.id);
              if (t) {
                const e = (n.index ?? n.config?.promptIndex ?? 0) + 1;
                e < t.payloads.length &&
                  (t.payloads[e] = {
                    ...t.payloads[e],
                    outputPreviousPrompt: {
                      nextPromptExtendVideo: r.nextPromptExtendVideo,
                      nextPromptEditImage: r.nextPromptEditImage,
                      extractedFrame: r.extractedFrame,
                    },
                  });
              }
            }
            H(n, e.id, U, Q);
          } else
            r.cancelled
              ? B(n, e.id, U, Q, r.error ?? "Download failed")
              : W(n, e.id, U, Q);
        }
        (e.status = "completed"), z.shift();
      } else z.shift();
    }
  })();
