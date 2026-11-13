// 북극 공식 '착한 어린이 임명장 & 약속 증서' 고해상도 이미지(1080x1350) HTML5 Canvas 생성 유틸리티

export interface CertificatePayload {
  childName: string;
  praise: string;
  missionPromise: string;
  santaComment: string;
  dateLabel?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapKoreanText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateGoodChildCertificateBlob(
  payload: CertificatePayload
): Promise<{ blob: Blob; dataUrl: string }> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  // 1. 깊은 북극 오로라 네이비 배경
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#0C1834");
  bgGrad.addColorStop(0.5, "#080E1E");
  bgGrad.addColorStop(1, "#120B18");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 상단 에메랄드/골드 오로라 글로우 & 하단 크림슨 글로우
  const topGlow = ctx.createRadialGradient(W / 2, 220, 30, W / 2, 220, 480);
  topGlow.addColorStop(0, "rgba(229, 193, 88, 0.22)");
  topGlow.addColorStop(0.6, "rgba(16, 185, 129, 0.08)");
  topGlow.addColorStop(1, "rgba(8, 14, 30, 0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, H);

  const botGlow = ctx.createRadialGradient(W / 2, H - 120, 40, W / 2, H - 120, 460);
  botGlow.addColorStop(0, "rgba(184, 29, 36, 0.24)");
  botGlow.addColorStop(1, "rgba(8, 14, 30, 0)");
  ctx.fillStyle = botGlow;
  ctx.fillRect(0, 0, W, H);

  // 은은한 별빛 파티클
  const stars = [
    [130, 160, 3],
    [940, 190, 2.5],
    [210, 340, 2],
    [880, 360, 3],
    [150, 720, 2],
    [920, 780, 2.5],
    [180, 1120, 3],
    [890, 1150, 2],
  ];
  ctx.fillStyle = "rgba(255, 244, 204, 0.7)";
  for (const [sx, sy, sr] of stars) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. 클래식 더블 샴페인 골드 테두리 프레임
  ctx.strokeStyle = "rgba(229, 193, 88, 0.65)";
  ctx.lineWidth = 3;
  ctx.strokeRect(54, 54, W - 108, H - 108);

  ctx.strokeStyle = "rgba(243, 220, 153, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(72, 72, W - 144, H - 144);

  // 3. 상단 영문 타이틀
  ctx.textAlign = "center";
  ctx.fillStyle = "#E5C158";
  ctx.font = "700 24px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  ctx.fillText("NORTH POLE OFFICIAL CERTIFICATE", W / 2, 142);

  // 4. 산타 황금 인장 엠블럼 이미지 합성 (원형 페이드 처리)
  try {
    const emblem = await loadImage("/images/santa-report-emblem.png");
    const size = 280;
    const ex = (W - size) / 2;
    const ey = 165;

    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const octx = off.getContext("2d");
    if (octx) {
      octx.drawImage(emblem, 0, 0, size, size);
      octx.globalCompositeOperation = "destination-in";
      const mask = octx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.26,
        size / 2,
        size / 2,
        size * 0.48
      );
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      octx.fillStyle = mask;
      octx.fillRect(0, 0, size, size);
      ctx.drawImage(off, ex, ey);
    }
  } catch {
    // 엠블럼 로드 실패 시 골드 원형 메달 폴백
  }

  // 5. 메인 증서 타이틀 & 어린이 이름
  ctx.fillStyle = "#FFF4CC";
  ctx.font = "800 58px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  ctx.fillText("착한 어린이 약속 증서", W / 2, 495);

  const displayName =
    payload.childName && payload.childName !== "우리 아이"
      ? `${payload.childName} 어린이`
      : "멋진 우리 아이";

  // 이름 배지 배경
  ctx.fillStyle = "rgba(229, 193, 88, 0.14)";
  ctx.strokeStyle = "rgba(243, 220, 153, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 220, 530, 440, 74, 37);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#FAF7F2";
  ctx.font = "800 38px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  ctx.fillText(`🌟 ${displayName} 🌟`, W / 2, 580);

  // 6. 본문 박스 1: 산타가 칭찬한 멋진 모습
  ctx.fillStyle = "rgba(20, 31, 56, 0.82)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(120, 645, W - 240, 185, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#E5C158";
  ctx.font = "700 26px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  ctx.fillText("산타할아버지가 칭찬한 일", W / 2, 698);

  ctx.fillStyle = "#FAF7F2";
  ctx.font = "600 31px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  const praiseLines = wrapKoreanText(ctx, payload.praise, W - 320).slice(0, 2);
  praiseLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, 752 + idx * 44);
  });

  // 7. 본문 박스 2: 손가락 걸고 한 약속
  ctx.fillStyle = "rgba(20, 31, 56, 0.82)";
  ctx.strokeStyle = "rgba(229, 193, 88, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(120, 858, W - 240, 185, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#F3DC99";
  ctx.font = "700 26px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  ctx.fillText("🤙 산타와 손가락 걸고 한 약속", W / 2, 912);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 33px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  const promiseLines = wrapKoreanText(
    ctx,
    payload.missionPromise,
    W - 320
  ).slice(0, 2);
  promiseLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, 968 + idx * 44);
  });

  // 8. 산타의 코멘트 & 하단 공식 서명/스탬프
  ctx.fillStyle = "rgba(250, 247, 242, 0.82)";
  ctx.font = "500 26px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  const commentLines = wrapKoreanText(
    ctx,
    `“${payload.santaComment}”`,
    W - 260
  ).slice(0, 2);
  commentLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, 1108 + idx * 38);
  });

  const dateText =
    payload.dateLabel ||
    new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  ctx.fillStyle = "#E5C158";
  ctx.font = "700 26px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  ctx.fillText(`${dateText} · 북극 산타 마을 산타할아버지`, W / 2, 1236);

  // 우측 하단 황금 '약속 도장' 인장
  ctx.save();
  ctx.translate(W - 195, 1195);
  ctx.rotate(-0.14);
  ctx.fillStyle = "rgba(229, 193, 88, 0.16)";
  ctx.strokeStyle = "#E5C158";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FFF2BF";
  ctx.font = "800 24px -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
  ctx.fillText("북극공식", 0, -6);
  ctx.fillText("약속도장", 0, 24);
  ctx.restore();

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });

  return { blob, dataUrl };
}
