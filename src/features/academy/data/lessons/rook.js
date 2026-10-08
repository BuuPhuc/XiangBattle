import { red, black, move } from '../helpers.js'

export const rookLesson = {
  id: 'rook',
  piece: 'rook',
  title: 'Xe',
  description: 'Đi đường thẳng không hạn chế số ô.',
  challenges: [
    {
      id: 'rook-1',
      title: 'Xe đi ngang',
      instruction: 'Xe đi theo đường thẳng. Hãy di chuyển Xe theo hàng ngang đến ô được đánh dấu.',
      showMoves: true,
      pieces: [red('rook', 1, 7)],
      steps: [{ accept: [move(1, 7, 6, 7)], target: [6, 7] }],
      hint: 'Xe có thể đi sang trái hoặc sang phải bao nhiêu ô tùy ý.',
    },
    {
      id: 'rook-2',
      title: 'Xe đi dọc',
      instruction: 'Xe cũng đi được theo cột dọc. Hãy đưa Xe tiến lên ô được đánh dấu.',
      pieces: [red('rook', 4, 8)],
      steps: [{ accept: [move(4, 8, 4, 3)], target: [4, 3] }],
      hint: 'Xe có thể tiến hoặc lùi bao nhiêu ô tùy ý trên cùng một cột.',
    },
    {
      id: 'rook-3',
      title: 'Xe đi nhiều ô',
      instruction: 'Xe không bị giới hạn số ô. Hãy đưa Xe đi hết cả cột trong một nước.',
      pieces: [red('rook', 0, 9)],
      steps: [{ accept: [move(0, 9, 0, 0)], target: [0, 0] }],
      hint: 'Chỉ cần đường đi không có quân nào cản, Xe đi được từ đầu này đến đầu kia bàn cờ.',
    },
    {
      id: 'rook-4',
      title: 'Bắt quân theo hàng ngang',
      instruction: 'Xe ăn quân bằng cách đi đến đúng vị trí của quân đối thủ. Hãy dùng Xe ăn quân Tốt đen.',
      pieces: [red('rook', 1, 5), black('pawn', 7, 5)],
      steps: [{ accept: [move(1, 5, 7, 5)] }],
      hint: 'Quân Tốt đen nằm cùng hàng ngang với Xe.',
    },
    {
      id: 'rook-5',
      title: 'Bắt quân theo cột dọc',
      instruction: 'Hãy dùng Xe ăn quân Mã đen ở phía trên.',
      pieces: [red('rook', 6, 8), black('horse', 6, 2)],
      steps: [{ accept: [move(6, 8, 6, 2)] }],
      hint: 'Quân Mã đen nằm cùng cột dọc với Xe.',
    },
    {
      id: 'rook-6',
      title: 'Chọn đúng đường đi',
      instruction: 'Xe không được nhảy qua quân khác. Xe đỏ có thể ăn quân Mã đen nào trong 1 nước đi?',
      pieces: [red('rook', 4, 7), red('pawn', 4, 4), black('horse', 4, 2), black('horse', 8, 7)],
      steps: [
        {
          accept: [move(4, 7, 8, 7)],
          mistakes: [{ to: [4, 2], message: 'Quân Tốt đỏ đang chắn đường. Xe không thể nhảy qua quân khác.' }],
        },
      ],
      hint: 'Hãy tìm quân Mã mà đường đi từ Xe đến đó không bị quân nào cản.',
    },
  ],
}

export default rookLesson
