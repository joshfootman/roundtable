const vertex = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`
const fragment = `precision mediump float;
uniform vec2 resolution;uniform float time;uniform float side;
float hash(vec2 p){return fract(sin(dot(p,vec2(71.27,139.61)))*17341.37);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.55;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(1.7,1.1,-1.1,1.7)*p+vec2(7.3,11.1);a*=.48;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 float t=time*.8;
 vec2 p=vec2(uv.x*3.8,uv.y*2.8-t*1.6);
 vec2 curl=vec2(fbm(p+vec2(0.,t*.35)),fbm(p+vec2(8.1,-t*.25)));
 vec2 q=p+(curl-.5)*2.1;
 float body=fbm(q+vec2(0.,-t*.45));
 float threads=fbm(q*1.6+vec2(4.,t*.6));
 float plume=body*.88+threads*.28+(1.-uv.y)*.40;
 float fuel=smoothstep(.52,.76,plume);
 float glow=smoothstep(.39,.69,plume);
 float core=smoothstep(.76,1.02,plume);
 float base=1.-smoothstep(.0,.19,uv.y);
 vec3 dark=mix(vec3(.025,.15,.39),vec3(.38,.055,.012),side);
 vec3 edge=mix(vec3(.03,.42,1.),vec3(1.,.24,.015),side);
 vec3 hot=mix(vec3(.30,.84,1.),vec3(1.,.65,.08),side);
 vec3 white=mix(vec3(.87,.98,1.),vec3(1.,.96,.75),side);
 vec3 color=mix(dark,edge,glow);
 color=mix(color,hot,fuel);
 color=mix(color,white,max(core,base*.92));
 float alpha=.30;
 gl_FragColor=vec4(color*alpha,alpha);
}`

export function mountScoreFlames(
  canvas: HTMLCanvasElement,
  side: 'ct' | 't',
  onFallback: () => void,
): () => void {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
  })
  if (!gl) {
    onFallback()
    return () => {}
  }
  const program = gl.createProgram()
  const buffer = gl.createBuffer()
  const shaders: WebGLShader[] = []
  let frame = 0
  let disposed = false
  let lost = false
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  const events = new AbortController()
  function cleanup() {
    disposed = true
    cancelAnimationFrame(frame)
    observer?.disconnect()
    events.abort()
    media.removeEventListener('change', resume)
    shaders.forEach((shader) => gl!.deleteShader(shader))
    gl!.deleteBuffer(buffer)
    gl!.deleteProgram(program)
    if (!lost) gl!.getExtension('WEBGL_lose_context')?.loseContext()
  }
  let observer: ResizeObserver | undefined
  if (!program || !buffer) {
    onFallback()
    cleanup()
    return cleanup
  }
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) {
      onFallback()
      cleanup()
      return cleanup
    }
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      onFallback()
      cleanup()
      return cleanup
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    onFallback()
    cleanup()
    return cleanup
  }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const resolution = gl.getUniformLocation(program, 'resolution')
  const clock = gl.getUniformLocation(program, 'time')
  gl.uniform1f(gl.getUniformLocation(program, 'side'), side === 't' ? 1 : 0)
  let last = -Infinity
  function paint(now: number) {
    gl!.uniform1f(clock, media.matches ? 4.2 : now / 1000)
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }
  function draw(now: number) {
    if (disposed || lost || document.hidden || media.matches) return
    if (now - last >= 1000 / 30) {
      paint(now)
      last = now
    }
    frame = requestAnimationFrame(draw)
  }
  function resume() {
    cancelAnimationFrame(frame)
    if (disposed || lost || document.hidden) return
    paint(performance.now())
    if (!media.matches) frame = requestAnimationFrame(draw)
  }
  function resize() {
    const ratio = Math.min(devicePixelRatio, 1.5)
    canvas.width = Math.max(1, Math.min(108, Math.round(canvas.clientWidth * ratio)))
    canvas.height = Math.max(1, Math.min(108, Math.round(canvas.clientHeight * ratio)))
    gl!.viewport(0, 0, canvas.width, canvas.height)
    gl!.uniform2f(resolution, canvas.width, canvas.height)
    resume()
  }
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(frame)
      onFallback()
    },
    { signal: events.signal },
  )
  document.addEventListener('visibilitychange', resume, { signal: events.signal })
  media.addEventListener('change', resume)
  observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  return cleanup
}
