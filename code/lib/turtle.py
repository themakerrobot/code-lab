"""AI Lab turtle — 브라우저용 turtle 모듈.

표준 turtle 은 tkinter 가 있어야 해서 브라우저에서 돌지 않는다.
이 모듈은 위치·방향 같은 상태를 파이썬 안에서 계산하고, 그릴 것만 명령으로
화면(lib/turtle-canvas.js)에 넘긴다. 그래서 position()·heading() 같은 질문은
바로 답하고, 그림은 화면 쪽에서 speed 에 맞춰 천천히 그려진다.

지원: Turtle · Screen · Pen 의 자주 쓰는 동작 (이동·회전·펜·색·채우기·circle·
dot·write·stamp·shape·speed·tracer·bgcolor·setup·colormode),
이벤트 onkey · onkeypress · onkeyrelease · onclick · onscreenclick · ontimer.
이벤트를 하나라도 걸면, 코드가 끝난 뒤에도 정지를 누를 때까지 이벤트를 기다린다.
아직 안 됨: ondrag, 여러 화면.
"""

import math as _math
import json as _json

import _codelab   # py-worker.js 가 넣어 둔 JS 모듈

__all__ = [
    'Turtle', 'Pen', 'RawTurtle', 'Screen', 'done', 'mainloop', 'bye',
    'exitonclick', 'colormode', 'bgcolor', 'setup', 'tracer', 'update',
    'speed', 'shape',
]

_SPEEDS = {'fastest': 0, 'fast': 10, 'normal': 6, 'slow': 3, 'slowest': 1}
_SHAPES = ('arrow', 'classic', 'turtle', 'circle', 'square', 'triangle', 'robot', 'blank')


def _send(*cmd):
    _codelab.turtle(_json.dumps(cmd))


# ── 이벤트 ──
# 화면(py-worker.js)이 키보드·마우스·타이머가 일어날 때 _dispatch 를 부른다.
_keys = {'press': {}, 'release': {}}   # Tk 키 이름 → 함수
_screen_click = [None]
_turtle_clicks = []                    # (거북이, 함수)
_timers = {}
_next_timer = [0]
_waiting = [False]                     # mainloop()/done() 을 불렀나


def _set_key(kind, fun, key):
    if key is None:
        return
    if fun is None:
        _keys[kind].pop(key, None)
    else:
        _keys[kind][key] = fun


def _ontimer(fun, t=0):
    if fun is None:
        return
    _next_timer[0] += 1
    tid = _next_timer[0]
    _timers[tid] = fun
    _codelab.timer(tid, int(t))


def _alive():
    return bool(_keys['press'] or _keys['release'] or _screen_click[0]
                or _turtle_clicks or _timers)


def _stop_events():
    _keys['press'].clear()
    _keys['release'].clear()
    _screen_click[0] = None
    _turtle_clicks.clear()
    _timers.clear()


def _dispatch(kind, key, x, y):
    if kind == 'timer':
        fun = _timers.pop(int(key), None)
        if fun:
            fun()
    elif kind in ('press', 'release'):
        fun = _keys[kind].get(key)
        if fun:
            fun()
    elif kind == 'click':
        hit = False
        for t, fun in list(_turtle_clicks):
            if t._visible and _math.hypot(t._x - x, t._y - y) <= 12:
                fun(x, y)
                hit = True
        if not hit and _screen_click[0]:
            _screen_click[0](x, y)


def _not_supported(name):
    raise NotImplementedError(
        f"turtle.{name}() 는 아직 지원하지 않아요 (키보드·마우스 이벤트) / "
        f"turtle.{name}() is not supported yet")


class _ScreenState:
    def __init__(self):
        self.mode = 1.0          # colormode
        self.tracer_on = True
        self.width = 400
        self.height = 400
        self.bg = 'white'
        self.turtles = []


_S = _ScreenState()
_next_id = [0]


def _color(args):
    """turtle 색 인자 → CSS 색 문자열."""
    if len(args) == 1:
        c = args[0]
    elif len(args) == 3:
        c = tuple(args)
    else:
        raise TypeError('색은 "red" 나 (r, g, b) 로 주세요 / give a color like "red" or (r, g, b)')
    if isinstance(c, str):
        s = c.strip()
        if s.startswith('#'):
            return s
        return s.replace(' ', '').lower()   # Tk 이름 'light blue' → CSS 'lightblue'
    if isinstance(c, (tuple, list)) and len(c) == 3:
        r, g, b = c
        if _S.mode == 1.0:
            if not all(0 <= v <= 1 for v in (r, g, b)):
                raise ValueError('colormode(1.0) 에서는 색 값이 0~1 이에요 / color values must be 0..1')
            r, g, b = (round(v * 255) for v in (r, g, b))
        else:
            if not all(0 <= v <= 255 for v in (r, g, b)):
                raise ValueError('colormode(255) 에서는 색 값이 0~255 예요 / color values must be 0..255')
            r, g, b = (int(v) for v in (r, g, b))
        return f'rgb({r},{g},{b})'
    raise TypeError('알 수 없는 색이에요 / unknown color: %r' % (c,))


class Turtle:
    def __init__(self, shape='classic', visible=True):
        _next_id[0] += 1
        self._id = _next_id[0]
        self._x = 0.0
        self._y = 0.0
        self._h = 0.0           # 도, 0 = 오른쪽, 반시계 방향
        self._down = True
        self._pencolor_raw = 'black'
        self._fillcolor_raw = 'black'
        self._pencolor = 'black'
        self._fillcolor = 'black'
        self._width = 1
        self._speed = 3
        self._visible = visible
        self._shape = shape
        self._filling = False
        self._fill_pts = []
        _S.turtles.append(self)
        _send('new', self._id, shape, visible)

    # ── 상태 알리기 ──
    def _pose(self):
        _send('pose', self._id, self._x, self._y, self._h)

    def _goto(self, x, y):
        x0, y0 = self._x, self._y
        self._x, self._y = float(x), float(y)
        if self._filling:
            self._fill_pts.append((self._x, self._y))
        _send('mv', self._id, x0, y0, self._x, self._y,
              self._down, self._pencolor, self._width, self._h)

    # ── 움직이기 ──
    def forward(self, distance):
        r = _math.radians(self._h)
        self._goto(self._x + distance * _math.cos(r), self._y + distance * _math.sin(r))

    def backward(self, distance):
        self.forward(-distance)

    def left(self, angle):
        self._h = (self._h + angle) % 360
        self._pose()

    def right(self, angle):
        self.left(-angle)

    def goto(self, x, y=None):
        if y is None:
            x, y = x
        self._goto(x, y)

    def setx(self, x):
        self._goto(x, self._y)

    def sety(self, y):
        self._goto(self._x, y)

    def setheading(self, to_angle):
        self._h = to_angle % 360
        self._pose()

    def home(self):
        self._goto(0, 0)
        self.setheading(0)

    def circle(self, radius, extent=None, steps=None):
        if extent is None:
            extent = 360
        frac = abs(extent) / 360
        if steps is None:
            steps = 1 + int(min(11 + abs(radius) / 6.0, 59.0) * frac)
        w = extent / steps
        w2 = 0.5 * w
        l = 2.0 * radius * _math.sin(_math.radians(w2))
        if radius < 0:
            l, w, w2 = -l, -w, -w2
        self._h = (self._h + w2) % 360
        for _ in range(steps):
            self.forward(l)
            self._h = (self._h + w) % 360
        self._h = (self._h - w2) % 360
        self._pose()

    def dot(self, size=None, *color):
        if size is None:
            size = max(self._width + 4, self._width * 2)
        c = _color(color) if color else self._pencolor
        _send('dot', self._id, self._x, self._y, size, c)

    def stamp(self):
        _send('stamp', self._id)
        return 0

    def write(self, arg, move=False, align='left', font=('Arial', 8, 'normal')):
        text = str(arg)
        name, size = (font[0], font[1]) if len(font) >= 2 else ('Arial', 8)
        style = font[2] if len(font) >= 3 else 'normal'
        _send('tx', self._id, self._x, self._y, text, align, name, size, style, self._pencolor)

    # ── 펜 ──
    def penup(self):
        self._down = False

    def pendown(self):
        self._down = True

    def isdown(self):
        return self._down

    def pensize(self, width=None):
        if width is None:
            return self._width
        self._width = width

    def pencolor(self, *args):
        if not args:
            return self._pencolor_raw
        self._pencolor = _color(args)
        self._pencolor_raw = args[0] if len(args) == 1 else tuple(args)

    def fillcolor(self, *args):
        if not args:
            return self._fillcolor_raw
        self._fillcolor = _color(args)
        self._fillcolor_raw = args[0] if len(args) == 1 else tuple(args)

    def color(self, *args):
        if not args:
            return self._pencolor_raw, self._fillcolor_raw
        if len(args) == 2:
            self.pencolor(args[0])
            self.fillcolor(args[1])
        else:
            self.pencolor(*args)
            self.fillcolor(*args)

    def begin_fill(self):
        self._filling = True
        self._fill_pts = [(self._x, self._y)]

    def end_fill(self):
        if self._filling and len(self._fill_pts) > 2:
            _send('fill', self._id, self._fill_pts, self._fillcolor)
        self._filling = False
        self._fill_pts = []

    def filling(self):
        return self._filling

    # ── 모양 · 빠르기 ──
    def speed(self, speed=None):
        if speed is None:
            return self._speed
        if isinstance(speed, str):
            speed = _SPEEDS.get(speed, 6)
        speed = int(round(speed))
        if not 0.5 < speed < 10.5:
            speed = 0
        self._speed = speed
        _send('speed', self._id, speed)

    def shape(self, name=None):
        if name is None:
            return self._shape
        if name not in _SHAPES:
            raise ValueError('모양은 %s 중에서 골라 주세요 / shape must be one of %s'
                             % (', '.join(_SHAPES), ', '.join(_SHAPES)))
        self._shape = name
        _send('shape', self._id, name)

    def hideturtle(self):
        self._visible = False
        _send('vis', self._id, False)

    def showturtle(self):
        self._visible = True
        _send('vis', self._id, True)

    def isvisible(self):
        return self._visible

    # ── 묻기 ──
    def position(self):
        return (round(self._x, 6), round(self._y, 6))

    def xcor(self):
        return round(self._x, 6)

    def ycor(self):
        return round(self._y, 6)

    def heading(self):
        return round(self._h, 6)

    def distance(self, x, y=None):
        if y is None:
            x, y = x.position() if isinstance(x, Turtle) else x
        return _math.hypot(x - self._x, y - self._y)

    def towards(self, x, y=None):
        if y is None:
            x, y = x.position() if isinstance(x, Turtle) else x
        return _math.degrees(_math.atan2(y - self._y, x - self._x)) % 360

    # ── 지우기 ──
    def clear(self):
        _send('clear', self._id)

    def reset(self):
        self.clear()
        self._down = True
        self._width = 1
        self._pencolor = self._fillcolor = 'black'
        self._pencolor_raw = self._fillcolor_raw = 'black'
        self._x = self._y = self._h = 0.0
        self._pose()

    def getscreen(self):
        return Screen()

    # 이벤트는 아직 없다
    def onclick(self, fun, btn=1, add=None):
        """이 거북이를 누르면 fun(x, y) 를 부른다."""
        _turtle_clicks[:] = [(t, f) for t, f in _turtle_clicks if t is not self]
        if fun is not None:
            _turtle_clicks.append((self, fun))

    def ondrag(self, *a, **k):
        _not_supported('ondrag')

    # 짧은 이름들
    fd = forward
    bk = back = backward
    lt = left
    rt = right
    setpos = setposition = goto
    seth = setheading
    pu = up = penup
    pd = down = pendown
    width = pensize
    ht = hideturtle
    st = showturtle
    pos = position


Pen = RawTurtle = Turtle


class _Screen:
    def bgcolor(self, *args):
        if not args:
            return _S.bg
        _S.bg = _color(args)
        _send('bg', _S.bg)

    def setup(self, width=400, height=400, startx=None, starty=None):
        if isinstance(width, float) and width <= 1:
            width = 400
        if isinstance(height, float) and height <= 1:
            height = 400
        _S.width, _S.height = int(width), int(height)
        _send('size', _S.width, _S.height)

    def screensize(self, canvwidth=None, canvheight=None, bg=None):
        if canvwidth is None:
            return _S.width, _S.height
        self.setup(canvwidth, canvheight or canvwidth)
        if bg is not None:
            self.bgcolor(bg)

    def window_width(self):
        return _S.width

    def window_height(self):
        return _S.height

    def colormode(self, cmode=None):
        if cmode is None:
            return _S.mode
        if cmode not in (1.0, 255):
            raise ValueError('colormode 는 1.0 또는 255 예요 / colormode must be 1.0 or 255')
        _S.mode = 255 if cmode == 255 else 1.0

    def tracer(self, n=None, delay=None):
        if n is None:
            return 1 if _S.tracer_on else 0
        _S.tracer_on = bool(n)
        _send('tracer', _S.tracer_on)

    def update(self):
        _send('update')

    def title(self, titlestring):
        pass

    def clear(self):
        _send('clearall')

    clearscreen = clear

    def reset(self):
        for t in list(_S.turtles):
            t.reset()

    resetscreen = reset

    def turtles(self):
        return list(_S.turtles)

    def mainloop(self):
        """브라우저에서는 막지 않는다 — 이벤트가 걸려 있으면 코드가 끝난 뒤 알아서 기다린다."""
        pass

    done = mainloop

    def bye(self):
        """이벤트 기다리기를 끝낸다 (창 닫기)."""
        _stop_events()

    def exitonclick(self):
        """화면을 한 번 누르면 끝낸다."""
        _screen_click[0] = lambda x, y: _stop_events()

    def onkeyrelease(self, fun, key=None):
        """키를 뗄 때 fun() 을 부른다. 키 이름은 'Up' 'Down' 'Left' 'Right' 'space' 'a' 'Return' 처럼."""
        _set_key('release', fun, key)

    onkey = onkeyrelease

    def onkeypress(self, fun, key=None):
        """키를 누를 때(누르고 있으면 계속) fun() 을 부른다."""
        _set_key('press', fun, key)

    def onclick(self, fun, btn=1, add=None):
        """화면을 누르면 fun(x, y) 를 부른다."""
        _screen_click[0] = fun

    onscreenclick = onclick

    def ontimer(self, fun, t=0):
        """t 밀리초 뒤에 fun() 을 한 번 부른다. 계속하려면 fun 안에서 다시 ontimer 를 건다."""
        _ontimer(fun, t)

    def listen(self, *a, **k):
        pass


_screen = _Screen()


def Screen():
    return _screen


# ── 모듈 함수: 이름 없는 거북이 하나로 그린다 (turtle.forward(100) 처럼) ──
_anon = []


def _get_anon():
    if not _anon:
        _anon.append(Turtle())
    return _anon[0]


def _make_proxy(name):
    def f(*args, **kwargs):
        return getattr(_get_anon(), name)(*args, **kwargs)
    f.__name__ = name
    return f


for _name in [n for n in dir(Turtle) if not n.startswith('_') and n not in ('getscreen',)]:
    globals()[_name] = _make_proxy(_name)
    __all__.append(_name)

for _name in ('bgcolor', 'setup', 'screensize', 'colormode', 'tracer', 'update', 'title',
              'mainloop', 'done', 'exitonclick', 'bye', 'listen', 'onkey', 'onkeypress', 'onkeyrelease',
              'onscreenclick', 'ontimer', 'window_width', 'window_height', 'turtles',
              'clearscreen', 'resetscreen'):
    globals()[_name] = getattr(_screen, _name)
    if _name not in __all__:
        __all__.append(_name)

# 모듈 이름 shape / speed / clear / reset 은 거북이 쪽을 쓴다 (표준 turtle 과 같다)
