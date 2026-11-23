// ═══════════════════════════════════════════════════════════
// 가운데 그림(캔버스)을 패널 안에 맞추기
// ═══════════════════════════════════════════════════════════
// 그림 크기를 가로 폭만 보고 정하면 넓은 화면에서 그림 높이가 패널보다 커져 가운데 패널만 스크롤된다.
// 그래서 패널(.pb)의 가로 폭과 "다른 내용을 빼고 남는 높이" 둘 다에 맞춘다.
//  · 그림 높이를 잠깐 0 으로 접고, 패널 자식들의 높이를 더해 남는 높이를 잰다
//    (scrollHeight 는 clientHeight 보다 작아지지 않아서 쓸 수 없다)
//  · 폰처럼 패널이 내용만큼 늘어나는 배치면 남는 높이가 없으니 가로 폭만 본다
//  · 그림이 폭보다 좁아지면 감싼 상자(box)의 max-width 를 줄이고 가운데에 둔다
// 반환: 상자 안쪽 폭(px) — 그림을 이 폭으로 그리면 된다.

export function fitInPanel({ box, target, aspect, minWidth = 240 }) {
  const pb = box.closest('.pb');
  const ps = getComputedStyle(pb);
  const availW = pb.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight);
  if (availW <= 0) return 0;
  const keep = target.style.height;
  target.style.height = '0px';
  let used = parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom);
  for (const el of pb.children) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
    used += el.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
  }
  // 패널 높이도 접은 채로 잰다 — 내용만큼 늘어나는 배치(폰)면 접은 만큼 줄어서 남는 높이가 0 이 된다
  const free = pb.clientHeight - used;
  target.style.height = keep;
  const bs = getComputedStyle(box);
  const border = parseFloat(bs.borderLeftWidth) + parseFloat(bs.borderRightWidth);
  let w = availW;
  if (free > 0) w = Math.min(availW, free / aspect + border);
  w = Math.floor(Math.max(Math.min(availW, minWidth), w));
  box.style.maxWidth = w < availW ? w + 'px' : '';
  return w - border;
}
