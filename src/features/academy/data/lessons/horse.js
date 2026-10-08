import { red, black, move } from '../helpers.js'

export const horseLesson = {
  id: 'horse',
  piece: 'horse',
  title: 'Mã',
  description: 'Di chuyển theo hình chữ L.',
  challenges: [
    {
      id: 'horse-1',
      title: 'Nước đi hình chữ L',
      instruction: 'Mã đi theo hình chữ L: 2 ô thẳng rồi 1 ô ngang. Hãy đưa Mã đến ô được đánh dấu.',
      showMoves: true,
      pieces: [red('horse', 4, 7)],
      steps: [{ accept: [move(4, 7, 5, 5)], target: [5, 5] }],
      hint: 'Đi lên 2 ô rồi rẽ sang phải 1 ô.',
    },
    {
      id: 'horse-2',
      title: 'Chữ L nằm ngang',
      instruction: 'Chữ L cũng có thể nằm ngang: 2 ô ngang rồi 1 ô dọc. Hãy đưa Mã đến ô được đánh dấu.',
      pieces: [red('horse', 2, 6)],
      steps: [{ accept: [move(2, 6, 4, 5)], target: [4, 5] }],
      hint: 'Đi sang phải 2 ô rồi tiến lên 1 ô.',
    },
    {
      id: 'horse-3',
      title: 'Mã bắt quân',
      instruction: 'Mã ăn quân nằm ở cuối nước đi hình chữ L. Hãy dùng Mã ăn quân Tốt đen.',
      pieces: [red('horse', 4, 6), black('pawn', 6, 5)],
      steps: [{ accept: [move(4, 6, 6, 5)] }],
      hint: 'Từ vị trí của Mã: sang phải 2 ô, lên 1 ô.',
    },
    {
      id: 'horse-4',
      title: 'Cản chân Mã',
      instruction:
        'Nếu có quân đứng sát ngay hướng Mã định đi 2 ô, Mã bị "cản chân". Quân Tốt đỏ đang cản phía trước — hãy đưa Mã đến ô được đánh dấu.',
      pieces: [red('horse', 4, 7), red('pawn', 4, 6)],
      steps: [
        {
          accept: [move(4, 7, 6, 6)],
          target: [6, 6],
          mistakes: [
            { to: [5, 5], message: 'Mã đang bị quân Tốt đỏ cản chân nên không thể đi lên phía trước.' },
            { to: [3, 5], message: 'Mã đang bị quân Tốt đỏ cản chân nên không thể đi lên phía trước.' },
          ],
        },
      ],
      hint: 'Hướng sang phải không bị cản: sang phải 2 ô rồi lên 1 ô.',
    },
    {
      id: 'horse-5',
      title: 'Ăn quân nào?',
      instruction: 'Mã ăn quân bằng cách di chuyển đến vị trí của quân đối thủ. Mã đỏ có thể ăn Xe đen nào trong 1 nước đi?',
      pieces: [red('horse', 4, 7), red('cannon', 4, 6), black('rook', 5, 5), black('rook', 2, 6)],
      steps: [
        {
          accept: [move(4, 7, 2, 6)],
          mistakes: [{ to: [5, 5], message: 'Quân Pháo đỏ đứng ngay trước mặt đang cản chân Mã.' }],
        },
      ],
      hint: 'Một trong hai hướng đang bị quân Pháo đỏ cản chân.',
    },
    {
      id: 'horse-6',
      title: 'Hai nước liên tiếp',
      instruction: 'Mã cần 2 nước đi để tới được quân Tốt đen. Hãy tìm đường và ăn quân Tốt.',
      pieces: [red('horse', 1, 9), black('pawn', 4, 6)],
      steps: [
        { accept: [move(1, 9, 2, 7), move(1, 9, 3, 8)] },
        { accept: [move(2, 7, 4, 6), move(3, 8, 4, 6)] },
      ],
      hint: 'Hãy nghĩ ngược lại: từ ô nào Mã có thể nhảy tới quân Tốt đen?',
    },
  ],
}

export default horseLesson
