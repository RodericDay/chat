export const calculateGridDimensions = (N: number) => {
  const { outerWidth: width, outerHeight: height } = window
  let [X, Y, max] = [1, 1, 0]
  for (let x = 1; x <= N; x += 1) {
    for (let y = 1; y <= N; y += 1) {
      if (x * y >= N) {
        const w = width / x
        const h = height / y
        const r = 3 / 4
        const a = Math.min(w * w * r, h * h / r)
        if (a > max) {
          max = a
          X = x
          Y = y
        }
      }
    }
  }
  return {
    gridTemplateColumns: Array(X).fill('1fr').join(' '),
    gridTemplateRows: Array(Y).fill('1fr').join(' '),
  }
}