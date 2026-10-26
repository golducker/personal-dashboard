// Short in-character lines, picked by context. Index 0 is the most relevant one.

export type LineContext = { overdue: number | null; today: number | null; hour: number };
export type Lines = { light: string[]; dark: string[] };

export function mascotLines({ overdue, today, hour }: LineContext): Lines {
  const light: string[] = [];
  const dark: string[] = [];

  if (overdue && overdue > 0) {
    light.push(
      `Quạc… ${overdue} việc quá hạn rồi. Đầu tui đau thêm một chút.`,
      "Làm một việc thôi, từ từ. Tui cũng đang cố nhớ mình là ai.",
    );
    dark.push(
      `Hehe… ${overdue} việc quá hạn đang thì thầm sau lưng bạn.`,
      "Việc bị bỏ quên ở lại trong bóng tối. Tôi thích chỗ đó.",
    );
  } else if (overdue === 0 && today === 0) {
    light.push("Hôm nay hết việc rồi. Sao tui vẫn thấy thiếu thiếu?", "Sạch sẽ luôn. Đầu tui vẫn đau nhưng vui.");
    dark.push("Không còn gì để dọa nữa. Hơi chán đấy.", "Sạch trơn. Tôi hơi thất vọng, nhưng khen bạn.");
  } else if (today && today > 0) {
    light.push(`Hôm nay có ${today} việc đến hạn. Tui đếm hai lần rồi.`);
    dark.push(`${today} việc đến hạn hôm nay. Làm đi, kẻo tôi cười.`);
  }

  if (hour < 11) {
    light.push("Sáng rồi à? Tui chưa kịp hiểu mình đang ở đâu.");
    dark.push("Trời sáng mà tôi vẫn thức. Kệ tôi.");
  } else if (hour >= 18) {
    light.push("Tối rồi, nghỉ thôi. Đầu tui cũng xin nghỉ.");
    dark.push("Đêm là sân nhà của tôi. Làm gì thì làm nhanh đi.");
  }

  light.push("Quạc?", "Tui quên mình định nói gì rồi.", "Bấm nữa là tui chóng mặt đó.");
  dark.push("Kekeke.", "Đằng sau bạn có gì kìa. Đùa thôi.", "Cù tôi là tôi cù lại đấy.");
  return { light, dark };
}
