export class LongestCommonSubsequence<T> {
      length: number;
      si: number;
      ti: number;
      reversed: boolean;
      constructor(public s: T[], public t: T[]) {
          var mf = LongestCommonSubsequence.findMatch(s, t);
          var tr = t.slice(0).reverse();
          var mr = LongestCommonSubsequence.findMatch(s, tr);
          if (mf.length >= mr.length) {
              this.length = mf.length;
              this.si = mf.si;
              this.ti = mf.ti;
              this.reversed = false;
          } else {
              this.length = mr.length;
              this.si = mr.si;
              this.ti = t.length - mr.ti - mr.length;
              this.reversed = true;
          }
      }
      private static findMatch<T>(s: T[], t: T[]) {
          var m = s.length;
          var n = t.length;
          var match = { length: 0, si: -1, ti: -1 };
          var l = new Array(m);
          for (var i = 0; i < m; i++) {
              l[i] = new Array(n);
              for (var j = 0; j < n; j++)
                  if (s[i] === t[j]) {
                      var v = l[i][j] = (i === 0 || j === 0) ? 1 : l[i - 1][j - 1] + 1;
                      if (v > match.length) {
                          match.length = v;
                          match.si = i - v + 1;
                          match.ti = j - v + 1;
                      };
                  } else l[i][j] = 0;
          }
          return match;
      }
      getSequence(): T[]{
          return this.length >= 0 ? this.s.slice(this.si, this.si + this.length) : [];
      }
  }