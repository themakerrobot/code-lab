// ═══════════════════════════════════════════════════════════
// 툴박스(왼쪽 분류)
// ═══════════════════════════════════════════════════════════
// 분류를 더하거나 빼려면 여기만 고친다.

const CODELAB_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      "kind": "category",
      "name": "시작",
      "contents": [
        {
          "kind": "block",
          "type": "flag_event"
        }
      ],
      "colour": "#E5B900",
      "cssConfig": {
        "icon": "customIcon fa-solid fa-circle-play"
      }
    },
    {
      "kind": "sep"
    },
    {
      "kind": "category",
      "colour": "#B098CB",
      "name": "논리",
      "cssConfig": {
        "icon": "customIcon fa fa-bars-staggered"
      },
      "contents": [
        {
          "kind": "block",
          "type": "controls_if"
        },
        {
          "kind": "block",
          "type": "logic_compare"
        },
        {
          "kind": "block",
          "type": "logic_operation"
        },
        {
          "kind": "block",
          "type": "logic_negate"
        },
        {
          "kind": "block",
          "type": "logic_boolean"
        },
        {
          "kind": "block",
          "type": "logic_null"
        },
        {
          "kind": "block",
          "type": "logic_ternary"
        }
      ]
    },
    {
      "kind": "category",
      "colour": "#85B687",
      "name": "반복",
      "cssConfig": {
        "icon": "customIcon fa fa-arrows-spin"
      },
      "contents": [
        {
          "kind": "block",
          "type": "controls_repeat_ext",
          "inputs": {
            "TIMES": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "10"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "controls_whileUntil"
        },
        {
          "kind": "block",
          "type": "controls_for",
          "inputs": {
            "FROM": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            },
            "TO": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "10"
                }
              }
            },
            "BY": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "controls_forEach"
        },
        {
          "kind": "block",
          "type": "controls_flow_statements"
        }
      ]
    },
    {
      "kind": "category",
      "colour": "#2196F3",
      "name": "수학",
      "cssConfig": {
        "icon": "customIcon fa fa-square-root-variable"
      },
      "contents": [
        {
          "kind": "block",
          "type": "math_number",
          "fields": {
            "NUM": "123"
          }
        },
        {
          "kind": "block",
          "type": "math_arithmetic",
          "inputs": {
            "A": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            },
            "B": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_single",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "9"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_trig",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "45"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_constant"
        },
        {
          "kind": "block",
          "type": "math_number_property",
          "inputs": {
            "NUMBER_TO_CHECK": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "0"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_round",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "3.1"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_on_list"
        },
        {
          "kind": "block",
          "type": "math_modulo",
          "inputs": {
            "DIVIDEND": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "64"
                }
              }
            },
            "DIVISOR": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "10"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_constrain",
          "inputs": {
            "VALUE": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "50"
                }
              }
            },
            "LOW": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            },
            "HIGH": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "100"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_random_int",
          "inputs": {
            "FROM": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            },
            "TO": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "100"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_random_float"
        },
        {
          "kind": "block",
          "type": "math_atan2",
          "inputs": {
            "X": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            },
            "Y": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "category",
      "colour": "#FFAA08",
      "name": "문자",
      "cssConfig": {
        "icon": "customIcon fa fa-t"
      },
      "contents": [
        {
          "kind": "block",
          "type": "text"
        },
        {
          "kind": "block",
          "type": "text_join"
        },
        {
          "kind": "block",
          "type": "text_append",
          "inputs": {
            "TEXT": {
              "shadow": {
                "type": "text"
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_length",
          "inputs": {
            "VALUE": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_isEmpty",
          "inputs": {
            "VALUE": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": null
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_indexOf",
          "inputs": {
            "VALUE": {
              "block": {
                "type": "variables_get",
                "fields": {
                  "VAR": "{textVariable}"
                }
              }
            },
            "FIND": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_charAt",
          "inputs": {
            "VALUE": {
              "block": {
                "type": "variables_get",
                "fields": {
                  "VAR": "{textVariable}"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_getSubstring",
          "inputs": {
            "STRING": {
              "block": {
                "type": "variables_get",
                "fields": {
                  "VAR": "{textVariable}"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_changeCase",
          "inputs": {
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_trim",
          "inputs": {
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_count",
          "inputs": {
            "SUB": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@a"
                }
              }
            },
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_replace",
          "inputs": {
            "FROM": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@b"
                }
              }
            },
            "TO": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@c"
                }
              }
            },
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_reverse",
          "inputs": {
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_print",
          "inputs": {
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "text_prompt_ext",
          "inputs": {
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@abc"
                }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "category",
      "colour": "#4DB6AC",
      "name": "목록",
      "cssConfig": {
        "icon": "customIcon fa fa-list"
      },
      "contents": [
        {
          "kind": "block",
          "type": "lists_create_with",
          "extraState": {
            "itemCount": "0"
          }
        },
        {
          "kind": "block",
          "type": "lists_create_with"
        },
        {
          "kind": "block",
          "type": "lists_repeat",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "5"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "lists_length"
        },
        {
          "kind": "block",
          "type": "lists_isEmpty"
        },
        {
          "kind": "block",
          "type": "lists_indexOf",
          "inputs": {
            "VALUE": {
              "block": {
                "type": "variables_get",
                "fields": {
                  "VAR": "{listVariable}"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "lists_getIndex",
          "inputs": {
            "VALUE": {
              "block": {
                "type": "variables_get",
                "fields": {
                  "VAR": "{listVariable}"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "lists_setIndex",
          "inputs": {
            "LIST": {
              "block": {
                "type": "variables_get",
                "fields": {
                  "VAR": "{listVariable}"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "lists_getSublist",
          "inputs": {
            "LIST": {
              "block": {
                "type": "variables_get",
                "fields": {
                  "VAR": "{listVariable}"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "lists_split",
          "inputs": {
            "DELIM": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": ","
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "lists_sort"
        },
        {
          "kind": "block",
          "type": "lists_reverse"
        }
      ]
    },
    {
      "kind": "category",
      "colour": "#DFADB2",
      "name": "색상",
      "cssConfig": {
        "icon": "customIcon fa fa-palette"
      },
      "contents": [
        {
          "kind": "block",
          "type": "colour_picker"
        },
        {
          "kind": "block",
          "type": "colour_random"
        },
        {
          "kind": "block",
          "type": "colour_rgb",
          "inputs": {
            "RED": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "100"
                }
              }
            },
            "GREEN": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "50"
                }
              }
            },
            "BLUE": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "0"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "colour_blend",
          "inputs": {
            "COLOUR1": {
              "shadow": {
                "type": "colour_picker",
                "fields": {
                  "COLOUR": "#ff0000"
                }
              }
            },
            "COLOUR2": {
              "shadow": {
                "type": "colour_picker",
                "fields": {
                  "COLOUR": "#3333ff"
                }
              }
            },
            "RATIO": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "0.5"
                }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "sep"
    },
    {
      "kind": "category",
      "colour": "#EF9A9A",
      "name": "변수",
      "contents": [],
      "custom": "VARIABLE",
      "cssConfig": {
        "icon": "customIcon fa fa-v"
      }
    },
    {
      "kind": "category",
      "colour": "#C7BCB8",
      "name": "함수",
      "contents": [],
      "custom": "PROCEDURE",
      "cssConfig": {
        "icon": "customIcon fa fa-florin-sign"
      }
    },
    {
      "kind": "sep"
    },
    {
      "kind": "category",
      "name": "도구",
      "contents": [
        {
          "kind": "block",
          "type": "utils_sleep",
          "inputs": {
            "time": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "utils_time"
        },
        {
          "kind": "block",
          "type": "utils_current_time"
        },
        {
          "kind": "block",
          "type": "utils_include"
        },
        {
          "kind": "block",
          "type": "utils_dict_get",
          "inputs": {
            "dictionary": {
              "shadow": {
                "type": "variables_get"
              }
            },
            "keyname": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@keyname"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "utils_dict_set",
          "inputs": {
            "dictionary": {
              "shadow": {
                "type": "variables_get"
              }
            },
            "keyname": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@keyname"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "utils_dict_create"
        },
        {
          "kind": "block",
          "type": "utils_array_slice_set",
          "inputs": {
            "arr": {
              "shadow": {
                "type": "variables_get"
              }
            },
            "y1": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "0"
                }
              }
            },
            "y2": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "0"
                }
              }
            },
            "x1": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "0"
                }
              }
            },
            "x2": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "0"
                }
              }
            },
            "value": {
              "shadow": {
                "type": "variables_get"
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "utils_check_path",
          "inputs": {
            "path": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "@path"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "utils_typecast_string",
          "inputs": {
            "value": {
              "shadow": {
                "type": "math_number",
                "fields": {
                  "NUM": "1"
                }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "utils_typecast_number",
          "inputs": {
            "value": {
              "shadow": {
                "type": "text",
                "fields": {
                  "TEXT": "1"
                }
              }
            }
          }
        }
      ],
      "colour": "#CC9988",
      "cssConfig": {
        "icon": "customIcon fa-solid fa-toolbox"
      }
    },
    {
      "kind": "sep"
    },
    {
      "kind": "category",
      "name": "센서",
      "colour": "#6E92B7",
      "cssConfig": { "icon": "customIcon fa-solid fa-video" },
      "contents": [
        { "kind": "label", "text": "손 · 얼굴 · 몸 (웹캠)" },
        { "kind": "block", "type": "sensor_hand_visible" },
        { "kind": "block", "type": "sensor_finger_count" },
        { "kind": "block", "type": "sensor_hand_pos" },
        { "kind": "block", "type": "sensor_face_check" },
        { "kind": "block", "type": "sensor_face_looking" },
        { "kind": "block", "type": "sensor_face_distance" },
        { "kind": "block", "type": "sensor_hands_up" },
        { "kind": "label", "text": "소리 (마이크)" },
        { "kind": "block", "type": "sensor_loudness" },
        { "kind": "block", "type": "sensor_clap" },
        { "kind": "label", "text": "말하기 (스피커)" },
        { "kind": "block", "type": "sensor_say", "inputs": { "TEXT": { "shadow": { "type": "text", "fields": { "TEXT": "안녕!" } } } } },
        { "kind": "label", "text": "내 AI (가르치기에서 만든 것)" },
        { "kind": "button", "text": "내 AI 다시 찾기", "callbackKey": "refreshAI" },
        { "kind": "button", "text": "가르치기 열기", "callbackKey": "openTeach" },
        { "kind": "block", "type": "sensor_model_label" },
        { "kind": "block", "type": "sensor_model_is", "inputs": { "LABEL": { "shadow": { "type": "text", "fields": { "TEXT": "가위" } } } } },
        { "kind": "block", "type": "sensor_stop" }
      ]
    }
  ],
};
