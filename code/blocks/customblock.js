// ═══════════════════════════════════════════════════════════
// 블록 모양 — 시작(깃발) + 도구
// ═══════════════════════════════════════════════════════════
// 기본 블록(논리·반복·수학·문자·목록·색상·변수·함수)은 Blockly 에 들어 있다.
// 문구는 vendor/blockly/ko.js · en.js 의 Blockly.Msg 를 쓴다 (%{BKY_…}). 어느 쪽을 부를지는 index.html 이 정한다.
// 센서 블록처럼 여기 직접 쓴 문구는 CL_T(한국어, 영어) — 상단바(nav.js)가 고른 말을 따른다.

const CL_EN = !!(window.AILAB && window.AILAB.lang === 'en');
const CL_T = (ko, en) => (CL_EN ? en : ko);

const CODELAB_COLOURS = {
  "start": "#E5B900",
  "utils": "#CC9988"
};

Blockly.defineBlocksWithJsonArray([
  {
    "type": "flag_event",
    "message0": "%{BKY_FLAG_EVENT}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/flag-solid.svg",
        "width": 27,
        "height": 27,
        "alt": "flag",
        "flip_rtl": true
      }
    ],
    "inputsInline": true,
    "nextStatement": null,
    "colour": CODELAB_COLOURS.start,
    "tooltip": "%{BKY_FLAG_EVENT_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_sleep",
    "message0": "%{BKY_UTILS_SLEEP}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/bed-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "input_value",
        "name": "time",
        "check": "Number"
      }
    ],
    "nextStatement": true,
    "previousStatement": true,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_SLEEP_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_time",
    "message0": "%{BKY_UTILS_TIME}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/stopwatch-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      }
    ],
    "output": null,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_TIME_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_current_time",
    "message0": "%{BKY_UTILS_CURRENT_TIME}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/clock-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      }
    ],
    "output": null,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_CURRENT_TIME_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_include",
    "message0": "%{BKY_UTILS_INCLUDE}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/list-check-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "input_value",
        "name": "a"
      },
      {
        "type": "input_value",
        "name": "b"
      }
    ],
    "output": null,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_INCLUDE_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_dict_get",
    "message0": "%{BKY_UTILS_DICT_GET}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/list-check-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "input_value",
        "name": "dictionary"
      },
      {
        "type": "input_value",
        "name": "keyname",
        "check": "String"
      }
    ],
    "output": null,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_DICT_GET_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_dict_set",
    "message0": "%{BKY_UTILS_DICT_SET}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/list-check-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "input_value",
        "name": "dictionary"
      },
      {
        "type": "input_value",
        "name": "keyname",
        "check": "String"
      },
      {
        "type": "input_value",
        "name": "value"
      }
    ],
    "nextStatement": true,
    "previousStatement": true,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_DICT_SET_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_dict_create",
    "message0": "%{BKY_UTILS_DICT_CREATE}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/database-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      }
    ],
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_DICT_CREATE_TOOLTIP}",
    "helpUrl": "",
    "output": null
  },
  {
    "type": "utils_array_slice_set",
    "message0": "%{BKY_UTILS_ARRAY_SLICE_SET}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/list-check-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "input_value",
        "name": "arr",
        "check": "Array"
      },
      {
        "type": "input_value",
        "name": "y1",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "y2",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "x1",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "x2",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "value"
      }
    ],
    "nextStatement": true,
    "previousStatement": true,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_ARRAY_SLICE_SET_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_check_path",
    "message0": "%{BKY_UTILS_CHECK_PATH}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/square-check-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "field_dropdown",
        "name": "type",
        "options": [
          [
            "%{BKY_UTILS_FILE}",
            "os.path.isfile"
          ],
          [
            "%{BKY_UTILS_DIRECTORY}",
            "os.path.isdir"
          ]
        ]
      },
      {
        "type": "input_value",
        "name": "path",
        "check": "String"
      }
    ],
    "output": null,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_CHECK_PATH_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_typecast_string",
    "message0": "%{BKY_UTILS_TYPECAST_STRING}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/right-left-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "input_value",
        "name": "value",
        "check": "Number"
      }
    ],
    "output": null,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_TYPECAST_STRING_TOOLTIP}",
    "helpUrl": ""
  },
  {
    "type": "utils_typecast_number",
    "message0": "%{BKY_UTILS_TYPECAST_NUMBER}",
    "args0": [
      {
        "type": "field_image",
        "src": "blocks/svg/right-left-solid.svg",
        "width": 27,
        "height": 27
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "field_dropdown",
        "name": "type",
        "options": [
          [
            "%{BKY_UTILS_INT}",
            "int"
          ],
          [
            "%{BKY_UTILS_FLOAT}",
            "float"
          ]
        ]
      },
      {
        "type": "input_value",
        "name": "value",
        "check": "String"
      }
    ],
    "output": null,
    "inputsInline": true,
    "colour": CODELAB_COLOURS.utils,
    "tooltip": "%{BKY_UTILS_TYPECAST_NUMBER_TOOLTIP}",
    "helpUrl": ""
  }
]);

// ═══════════════════════════════════════════════════════════
// 센서 블록 — 웹캠·마이크 (lib/sensor.py 를 부른다)
// ═══════════════════════════════════════════════════════════
CODELAB_COLOURS.sensor = '#6E92B7';

(function () {
  const icon = (f) => ({ type: 'field_image', src: 'blocks/svg/' + f, width: 27, height: 27 });
  const C = CODELAB_COLOURS.sensor;
  Blockly.defineBlocksWithJsonArray([
    { type: 'sensor_hand_visible', message0: CL_T('%1 손이 보이나?', '%1 hand visible?'), args0: [icon('hand-solid.svg')],
      output: 'Boolean', colour: C, tooltip: CL_T('카메라에 손이 보이면 참', 'True if a hand is on camera') },
    { type: 'sensor_finger_count', message0: CL_T('%1 편 손가락 개수', '%1 fingers up'), args0: [icon('hand-solid.svg')],
      output: null, colour: C, tooltip: CL_T('편 손가락 수 (0~5). 손이 안 보이면 None', 'Fingers up (0–5). None if no hand') },
    { type: 'sensor_hand_pos', message0: CL_T('%1 손 위치 %2', '%1 hand position %2'), args0: [icon('hand-solid.svg'),
      { type: 'field_dropdown', name: 'AXIS', options: [[CL_T('가로 (x)', 'across (x)'), 'hand_x'], [CL_T('세로 (y)', 'up-down (y)'), 'hand_y']] }],
      output: null, colour: C, tooltip: CL_T('-100 ~ 100. 가운데가 0, 오른쪽·위가 + . 안 보이면 None', '-100 to 100. Centre is 0, right and up are +. None if not seen') },
    { type: 'sensor_face_check', message0: CL_T('%1 얼굴이 %2', '%1 face %2'), args0: [icon('face-smile-solid.svg'),
      { type: 'field_dropdown', name: 'WHAT', options: [[CL_T('보이나?', 'visible?'), 'face_visible'], [CL_T('입을 벌렸나?', 'mouth open?'), 'mouth_open'], [CL_T('웃고 있나?', 'smiling?'), 'smiling']] }],
      output: 'Boolean', colour: C, tooltip: CL_T('얼굴 상태가 맞으면 참', 'True if the face matches') },
    { type: 'sensor_face_looking', message0: CL_T('%1 얼굴이 %2 쪽을 보나?', '%1 face looking %2?'), args0: [icon('face-smile-solid.svg'),
      { type: 'field_dropdown', name: 'DIR', options: [[CL_T('왼쪽', 'left'), 'left'], [CL_T('오른쪽', 'right'), 'right'], [CL_T('위', 'up'), 'up'], [CL_T('아래', 'down'), 'down'], [CL_T('가운데', 'centre'), 'center']] }],
      output: 'Boolean', colour: C, tooltip: CL_T('내가 보는 방향 기준 (거울처럼)', 'As you see it (like a mirror)') },
    { type: 'sensor_face_distance', message0: CL_T('%1 얼굴까지 거리 (cm)', '%1 face distance (cm)'), args0: [icon('face-smile-solid.svg')],
      output: null, colour: C, tooltip: CL_T('대략적인 거리. 안 보이면 None', 'Rough distance. None if not seen') },
    { type: 'sensor_hands_up', message0: CL_T('%1 머리 위로 든 손의 수', '%1 hands above head'), args0: [icon('person-solid.svg')],
      output: null, colour: C, tooltip: CL_T('0, 1, 2 (몸 전체가 보이게 서 주세요)', '0, 1, 2 (stand so your whole body shows)') },
    { type: 'sensor_loudness', message0: CL_T('%1 소리 크기', '%1 loudness'), args0: [icon('microphone-solid.svg')],
      output: null, colour: C, tooltip: '0 ~ 100' },
    { type: 'sensor_clap', message0: CL_T('%1 박수 소리가 났나?', '%1 clap heard?'), args0: [icon('microphone-solid.svg')],
      output: 'Boolean', colour: C, tooltip: CL_T('지난번에 물은 뒤로 갑자기 큰 소리가 났으면 참', 'True if a sudden loud sound came since you last asked') },
    { type: 'sensor_say', message0: CL_T('%1 AI 목소리로 말하기 %2', '%1 say with AI voice %2'), args0: [icon('microphone-solid.svg'), { type: 'input_value', name: 'TEXT' }],
      previousStatement: null, nextStatement: null, colour: C, tooltip: CL_T('이 기기 안의 목소리로 읽어요. 글은 밖으로 나가지 않아요', 'Reads with a voice on this device. Text stays here') },
    { type: 'sensor_stop', message0: CL_T('%1 카메라·마이크 끄기', '%1 camera · mic off'), args0: [icon('microphone-solid.svg')],
      previousStatement: null, nextStatement: null, colour: C, tooltip: CL_T('프로그램이 끝나면 저절로 꺼져요', 'Turns off by itself when the program ends') },
  ]);

  // 내 AI 블록: 가르치기에서 만든 AI 이름으로 고른다 (보관함을 바로 읽는다 — my-ai.js)
  const SRC_KO = CL_EN ? { image: 'image', hand: 'hand', face: 'face', pose: 'body', sound: 'sound' } : { image: '사진', hand: '손', face: '얼굴', pose: '몸', sound: '소리' };
  function modelOptions() {
    const list = (window.MyAI ? MyAI.list() : []).map(m => [m.name + ' (' + (SRC_KO[m.source] || m.source) + ')', m.name]);
    return list.length ? list : [[CL_T('(아직 없어요)', '(none yet)'), '']];
  }
  Blockly.Blocks['sensor_model_label'] = {
    init() {
      this.jsonInit({ message0: CL_T('%1 내 AI %2 가 본 것', '%1 my AI %2 sees'), args0: [icon('brain-solid.svg'), { type: 'input_dummy', name: 'M' }],
        output: null, colour: C, tooltip: CL_T('가르치기에서 만든 AI 가 지금 본 종류 이름. 확실하지 않으면 None', 'The class your AI sees now. None if unsure') });
      this.getInput('M').appendField(new Blockly.FieldDropdown(modelOptions), 'NAME');
    },
  };
  Blockly.Blocks['sensor_model_is'] = {
    init() {
      this.jsonInit({ message0: CL_T('%1 내 AI %2 가 %3 을(를) 보나?', '%1 my AI %2 sees %3 ?'),
        args0: [icon('brain-solid.svg'), { type: 'input_dummy', name: 'M' }, { type: 'input_value', name: 'LABEL', check: 'String' }],
        inputsInline: true, output: 'Boolean', colour: C, tooltip: CL_T('내 AI 가 그 종류라고 보면 참', 'True if your AI sees that class') });
      this.getInput('M').appendField(new Blockly.FieldDropdown(modelOptions), 'NAME');
    },
  };
})();
