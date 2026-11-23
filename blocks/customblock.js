// ═══════════════════════════════════════════════════════════
// 블록 모양 — 시작(깃발) + 도구
// ═══════════════════════════════════════════════════════════
// 기본 블록(논리·반복·수학·문자·목록·색상·변수·함수)은 Blockly 에 들어 있다.
// 문구는 vendor/blockly/ko.js 의 Blockly.Msg 를 쓴다 (%{BKY_…}).

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
    { type: 'sensor_hand_visible', message0: '%1 손이 보이나?', args0: [icon('hand-solid.svg')],
      output: 'Boolean', colour: C, tooltip: '카메라에 손이 보이면 참' },
    { type: 'sensor_finger_count', message0: '%1 편 손가락 개수', args0: [icon('hand-solid.svg')],
      output: null, colour: C, tooltip: '편 손가락 수 (0~5). 손이 안 보이면 None' },
    { type: 'sensor_hand_pos', message0: '%1 손 위치 %2', args0: [icon('hand-solid.svg'),
      { type: 'field_dropdown', name: 'AXIS', options: [['가로 (x)', 'hand_x'], ['세로 (y)', 'hand_y']] }],
      output: null, colour: C, tooltip: '-100 ~ 100. 가운데가 0, 오른쪽·위가 + . 안 보이면 None' },
    { type: 'sensor_face_check', message0: '%1 얼굴이 %2', args0: [icon('face-smile-solid.svg'),
      { type: 'field_dropdown', name: 'WHAT', options: [['보이나?', 'face_visible'], ['입을 벌렸나?', 'mouth_open'], ['웃고 있나?', 'smiling']] }],
      output: 'Boolean', colour: C, tooltip: '얼굴 상태가 맞으면 참' },
    { type: 'sensor_face_looking', message0: '%1 얼굴이 %2 쪽을 보나?', args0: [icon('face-smile-solid.svg'),
      { type: 'field_dropdown', name: 'DIR', options: [['왼쪽', 'left'], ['오른쪽', 'right'], ['위', 'up'], ['아래', 'down'], ['가운데', 'center']] }],
      output: 'Boolean', colour: C, tooltip: '내가 보는 방향 기준 (거울처럼)' },
    { type: 'sensor_face_distance', message0: '%1 얼굴까지 거리 (cm)', args0: [icon('face-smile-solid.svg')],
      output: null, colour: C, tooltip: '대략적인 거리. 안 보이면 None' },
    { type: 'sensor_hands_up', message0: '%1 머리 위로 든 손의 수', args0: [icon('person-solid.svg')],
      output: null, colour: C, tooltip: '0, 1, 2 (몸 전체가 보이게 서 주세요)' },
    { type: 'sensor_loudness', message0: '%1 소리 크기', args0: [icon('microphone-solid.svg')],
      output: null, colour: C, tooltip: '0 ~ 100' },
    { type: 'sensor_clap', message0: '%1 박수 소리가 났나?', args0: [icon('microphone-solid.svg')],
      output: 'Boolean', colour: C, tooltip: '지난번에 물은 뒤로 갑자기 큰 소리가 났으면 참' },
    { type: 'sensor_stop', message0: '%1 카메라·마이크 끄기', args0: [icon('microphone-solid.svg')],
      previousStatement: null, nextStatement: null, colour: C, tooltip: '프로그램이 끝나면 저절로 꺼져요' },
  ]);

  // 내 모델(sense-lab) 블록: 불러온 모델 이름으로 고른다
  function modelOptions() {
    const list = (window.SenseModels ? SenseModels.list() : []).map(m => [m.name, m.name]);
    return list.length ? list : [['(모델 없음)', '']];
  }
  Blockly.Blocks['sensor_model_label'] = {
    init() {
      this.jsonInit({ message0: '%1 내 모델 %2 이 본 것', args0: [icon('brain-solid.svg'), { type: 'input_dummy', name: 'M' }],
        output: null, colour: C, tooltip: 'sense-lab 에서 배운 종류 이름. 아무것도 안 보이면 None' });
      this.getInput('M').appendField(new Blockly.FieldDropdown(modelOptions), 'NAME');
    },
  };
  Blockly.Blocks['sensor_model_is'] = {
    init() {
      this.jsonInit({ message0: '%1 내 모델 %2 이 %3 을(를) 보나?',
        args0: [icon('brain-solid.svg'), { type: 'input_dummy', name: 'M' }, { type: 'input_value', name: 'LABEL', check: 'String' }],
        inputsInline: true, output: 'Boolean', colour: C, tooltip: 'sense-lab 모델이 그 종류라고 보면 참' });
      this.getInput('M').appendField(new Blockly.FieldDropdown(modelOptions), 'NAME');
    },
  };
})();
