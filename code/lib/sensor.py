"""AI Lab sensor — 웹캠·마이크로 손·얼굴·몸·소리를 읽는다.

가르치기와 같은 AI(MediaPipe)가 브라우저 안에서만 돈다. 영상·소리는 밖으로 나가지 않는다.
처음 쓰는 순간 카메라(또는 마이크)를 켜고 준비될 때까지 잠깐 기다린다.

    import sensor
    while True:
        print(sensor.finger_count())

손        hand_visible() · finger_count() · hand_x() · hand_y() · hand_count()
얼굴      face_visible() · face_distance() · face_direction() · looking(방향)
          mouth_open() · smiling()
몸        body_visible() · hands_up()
소리      loudness() · clap()
내 AI     model(이름) · model_confidence(이름) · models()   (가르치기에서 만든 AI — 보관함에서 바로)
끄기      stop()
"""

import json as _json
import time as _time

import _codelab

_CACHE_S = 0.03       # 이 시간 안에 다시 물으면 앞 값을 쓴다
_WAIT_S = 40          # 카메라·모델 준비를 기다리는 최대 시간

_cache = [0.0, {}]
_asked = set()
_seen_clap = [0]

__all__ = [
    'hand_visible', 'finger_count', 'hand_x', 'hand_y', 'hand_count',
    'face_visible', 'face_distance', 'face_direction', 'face_up_down', 'looking',
    'mouth_open', 'smiling', 'body_visible', 'hands_up', 'loudness', 'clap',
    'model', 'model_confidence', 'models', 'stop',
]


class SensorError(RuntimeError):
    pass


def _state(fresh=False):
    now = _time.monotonic()
    if fresh or now - _cache[0] > _CACHE_S:
        raw = _codelab.sensor_read()
        try:
            _cache[1] = _json.loads(raw) if raw else {}
        except ValueError:
            _cache[1] = {}
        _cache[0] = now
    return _cache[1]


def _need(what, label):
    if not _codelab.can_sync():
        raise SensorError('센서를 준비하지 못했어요. 페이지를 새로고침한 뒤 다시 실행해 주세요')
    st = _state()
    if st.get('ready', {}).get(what):
        return st
    if what not in _asked:
        _asked.add(what)
        print(f'[{label} 켜는 중…]')
        _codelab.sensor_need(what)
    t0 = _time.monotonic()
    while True:
        st = _state(fresh=True)
        if st.get('ready', {}).get(what):
            return st
        err = st.get('error', {}).get(what)
        if err:
            _asked.discard(what)
            raise SensorError(err)
        if _time.monotonic() - t0 > _WAIT_S:
            _asked.discard(what)
            raise SensorError(f'{label}를 준비하지 못했어요')
        _time.sleep(0.05)


def _hand():
    return _need('hand', '카메라(손)').get('hand') or {}


def _face():
    return _need('face', '카메라(얼굴)').get('face') or {}


def _pose():
    return _need('pose', '카메라(몸)').get('pose') or {}


def _sound():
    return _need('sound', '마이크').get('sound') or {}


# ── 손 ──
def hand_visible():
    """손이 보이면 True."""
    return bool(_hand().get('shown'))


def finger_count():
    """편 손가락 수 (0~5). 손이 안 보이면 None."""
    h = _hand()
    return h.get('fingers') if h.get('shown') else None


def hand_x():
    """손의 가로 위치 (-100 왼쪽 ~ 100 오른쪽). 안 보이면 None."""
    h = _hand()
    return h.get('x') if h.get('shown') else None


def hand_y():
    """손의 세로 위치 (-100 아래 ~ 100 위). 안 보이면 None."""
    h = _hand()
    return h.get('y') if h.get('shown') else None


def hand_count():
    """보이는 손의 수 (0~2)."""
    return int(_hand().get('hands') or 0)


# ── 얼굴 ──
def face_visible():
    """얼굴이 보이면 True."""
    return bool(_face().get('shown'))


def face_distance():
    """카메라와 얼굴 사이 거리(cm, 대략). 안 보이면 None."""
    f = _face()
    return f.get('distCm') if f.get('shown') else None


def face_direction():
    """얼굴이 보는 쪽: 'left' · 'right' · 'center'. 안 보이면 None."""
    f = _face()
    return f.get('yaw') if f.get('shown') else None


def face_up_down():
    """얼굴이 위·아래를 보나: 'up' · 'down' · 'center'. 안 보이면 None."""
    f = _face()
    return f.get('pitch') if f.get('shown') else None


def looking(direction):
    """얼굴이 그쪽을 보면 True. direction: 'left' 'right' 'up' 'down' 'center'."""
    f = _face()
    if not f.get('shown'):
        return False
    if direction in ('up', 'down'):
        return f.get('pitch') == direction
    if direction == 'center':
        return f.get('yaw') == 'center' and f.get('pitch') == 'center'
    return f.get('yaw') == direction


def mouth_open():
    """입을 벌리면 True."""
    f = _face()
    return bool(f.get('shown') and f.get('mouth'))


def smiling():
    """웃고 있으면 True."""
    f = _face()
    return bool(f.get('shown') and f.get('smile'))


# ── 몸 ──
def body_visible():
    """몸(포즈)이 보이면 True."""
    return bool(_pose().get('shown'))


def hands_up():
    """머리 위로 든 손의 수 (0~2)."""
    p = _pose()
    return int(p.get('handsUp') or 0) if p.get('shown') else 0


# ── 소리 ──
def loudness():
    """소리 크기 (0~100)."""
    return int(_sound().get('level') or 0)


def clap():
    """지난번에 물은 뒤로 박수(갑자기 큰 소리)가 있었으면 True."""
    at = int(_sound().get('clapAt') or 0)
    if at and at != _seen_clap[0]:
        _seen_clap[0] = at
        return True
    return False


# ── 가르치기에서 만든 내 AI ──
def models():
    """보관함에 있는 내 AI 이름들."""
    try:
        return list(_json.loads(_codelab.model_list()))
    except ValueError:
        return []


def _model(name):
    st = _need('model:' + name, f"내 AI '{name}'")
    return (st.get('models') or {}).get(name) or {}


def model(name):
    """내 AI 가 지금 본 종류 이름. 확실하지 않으면 None."""
    return _model(name).get('label')


def model_confidence(name):
    """그 종류라고 확신하는 정도 (0~1)."""
    return float(_model(name).get('conf') or 0)


def stop():
    """카메라·마이크를 끈다 (프로그램이 끝나면 저절로 꺼진다)."""
    _codelab.sensor_need('off')
    _asked.clear()
    _cache[0] = 0.0
