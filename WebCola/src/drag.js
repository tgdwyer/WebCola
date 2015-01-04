module.exports = {
	dragstart: function (d) {
    d.fixed |= 2; // set bit 2
    d.px = d.x, d.py = d.y; // set velocity to zero
  },

  dragend: function (d) {
    d.fixed &= ~6; // unset bits 2 and 3
    //d.fixed = 0;
  }
};