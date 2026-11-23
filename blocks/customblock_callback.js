// ═══════════════════════════════════════════════════════════
// 블록 → 파이썬 코드 (시작 + 도구)
// ═══════════════════════════════════════════════════════════
// import 는 Blockly.Python.definitions_ 에 넣으면 코드 맨 위에 한 번만 들어간다.

(function () {
  const PY = Blockly.Python;
  const val = (block, name, order) => PY.valueToCode(block, name, order === undefined ? PY.ORDER_ATOMIC : order);

  PY.forBlock['flag_event'] = function () {
    return '';
  };

  PY.forBlock['utils_sleep'] = function (block) {
    PY.definitions_['import_time'] = 'import time';
    return `time.sleep(${val(block, 'time') || 0})\n`;
  };

  PY.forBlock['utils_time'] = function () {
    PY.definitions_['import_time'] = 'import time';
    return ['time.time()', PY.ORDER_FUNCTION_CALL];
  };

  PY.forBlock['utils_current_time'] = function () {
    PY.definitions_['import_time'] = 'import time';
    return ["time.strftime('%Y-%m-%d %H:%M:%S')", PY.ORDER_FUNCTION_CALL];
  };

  // a in b — 'in' 은 비교 연산이라 우선순위를 RELATIONAL 로 맞춘다
  PY.forBlock['utils_include'] = function (block) {
    const a = val(block, 'a', PY.ORDER_RELATIONAL) || 'None';
    const b = val(block, 'b', PY.ORDER_RELATIONAL) || '[]';
    return [`${a} in ${b}`, PY.ORDER_RELATIONAL];
  };

  PY.forBlock['utils_dict_get'] = function (block) {
    const d = val(block, 'dictionary', PY.ORDER_MEMBER) || '{}';
    const k = val(block, 'keyname', PY.ORDER_NONE) || "''";
    return [`${d}[${k}]`, PY.ORDER_MEMBER];
  };

  // 값 칸이 비어도 문법 오류가 나지 않게 None 을 넣는다
  PY.forBlock['utils_dict_set'] = function (block) {
    const d = val(block, 'dictionary', PY.ORDER_MEMBER) || '{}';
    const k = val(block, 'keyname', PY.ORDER_NONE) || "''";
    const v = val(block, 'value', PY.ORDER_NONE) || 'None';
    return `${d}[${k}] = ${v}\n`;
  };

  PY.forBlock['utils_dict_create'] = function () {
    return ['dict()', PY.ORDER_FUNCTION_CALL];
  };

  // numpy 배열 일부 바꾸기: arr[y1:y2, x1:x2] = value
  PY.forBlock['utils_array_slice_set'] = function (block) {
    const arr = val(block, 'arr', PY.ORDER_MEMBER) || 'arr';
    const y1 = val(block, 'y1') || '';
    const y2 = val(block, 'y2') || '';
    const x1 = val(block, 'x1') || '';
    const x2 = val(block, 'x2') || '';
    const v = val(block, 'value', PY.ORDER_NONE) || 'None';
    return `${arr}[${y1}:${y2}, ${x1}:${x2}] = ${v}\n`;
  };

  PY.forBlock['utils_check_path'] = function (block) {
    PY.definitions_['import_os'] = 'import os';
    const type = block.getFieldValue('type');
    const path = val(block, 'path', PY.ORDER_NONE) || "''";
    return [`${type}(${path})`, PY.ORDER_FUNCTION_CALL];
  };

  PY.forBlock['utils_typecast_string'] = function (block) {
    return [`str(${val(block, 'value', PY.ORDER_NONE) || "''"})`, PY.ORDER_FUNCTION_CALL];
  };

  PY.forBlock['utils_typecast_number'] = function (block) {
    const type = block.getFieldValue('type');
    return [`${type}(${val(block, 'value', PY.ORDER_NONE) || 0})`, PY.ORDER_FUNCTION_CALL];
  };
})();
