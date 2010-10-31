function a(b, c) { return b.splice(b.indexOf(c), 1) }

d = [1,2,3,4]
console.log(a(d,3))
console.log(d);