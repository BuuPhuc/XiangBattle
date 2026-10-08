import { red, black, move } from '../helpers.js'

export const cannonLesson = {
  id: 'cannon',
  piece: 'cannon',
  title: 'Pháo',
  description: 'Đi như Xe, nhưng ăn quân phải nhảy qua đúng một quân làm ngòi.',
  challenges: [
    {
      id: 'cannon-1',
      title: 'Pháo đi ngang',
      instruction: 'Khi không ăn quân, Pháo đi giống hệt Xe. Hãy đưa Pháo theo hàng ngang đến ô được đánh dấu.',
      showMoves: true,
      pieces: [red('cannon', 1, 7)],
      steps: [{ accept: [move(1, 7, 7, 7)], target: [7, 7] }],
      hint: 'Pháo đi sang ngang bao nhiêu ô tùy ý.',
    },
    {
      id: 'cannon-2',
      title: 'Pháo đi dọc',
      instruction: 'Hãy đưa Pháo tiến theo cột dọc đến ô được đánh dấu.',
      pieces: [red('cannon', 4, 7)],
      steps: [{ accept: [move(4, 7, 4, 3)], target: [4, 3] }],
      hint: 'Pháo tiến thẳng bao nhiêu ô tùy ý.',
    },
    {
      id: 'cannon-3',
      title: 'Ăn quân qua ngòi',
      instruction:
        'Để ăn quân, Pháo phải nhảy qua đúng một quân ở giữa — gọi là "ngòi". Quân Tốt đỏ đang làm ngòi, hãy dùng Pháo ăn quân Mã đen.',
      pieces: [red('cannon', 4, 7), red('pawn', 4, 5), black('horse', 4, 2)],
      steps: [{ accept: [move(4, 7, 4, 2)] }],
      hint: 'Pháo nhảy qua quân Tốt đỏ để ăn quân Mã ở phía sau.',
    },
    {
      id: 'cannon-4',
      title: 'Không có ngòi',
      instruction: 'Không có ngòi thì Pháo không ăn được quân. Pháo đỏ có thể ăn quân Xe đen nào?',
      pieces: [red('cannon', 4, 7), black('rook', 4, 3), black('rook', 8, 7), black('pawn', 6, 7)],
      steps: [
        {
          accept: [move(4, 7, 8, 7)],
          mistakes: [
            { to: [4, 3], message: 'Giữa Pháo và quân Xe này không có quân nào làm ngòi nên Pháo không ăn được.' },
            { to: [6, 7], message: 'Giữa Pháo và quân Tốt này không có ngòi. Hãy dùng chính nó làm ngòi để ăn quân phía sau.' },
          ],
        },
      ],
      hint: 'Ngòi có thể là quân của đối thủ.',
    },
    {
      id: 'cannon-5',
      title: 'Đúng một ngòi',
      instruction: 'Pháo chỉ ăn được khi ở giữa có đúng một quân — không hơn, không kém. Pháo đỏ có thể ăn quân nào?',
      pieces: [
        red('cannon', 0, 5),
        red('pawn', 2, 5),
        black('pawn', 4, 5),
        black('rook', 7, 5),
        black('horse', 0, 1),
      ],
      steps: [
        {
          accept: [move(0, 5, 4, 5)],
          mistakes: [
            { to: [7, 5], message: 'Giữa Pháo và quân Xe có tới 2 quân. Pháo chỉ nhảy qua được đúng một ngòi.' },
            { to: [0, 1], message: 'Giữa Pháo và quân Mã không có quân nào làm ngòi.' },
          ],
        },
      ],
      hint: 'Hãy đếm số quân nằm giữa Pháo và từng quân đen.',
    },
    {
      id: 'cannon-6',
      title: 'Tìm ngòi cho Pháo',
      instruction: 'Hãy dùng 2 nước đi để Pháo ăn quân Xe đen: trước tiên đưa Pháo ra sau quân Tốt đỏ để có ngòi.',
      pieces: [red('cannon', 1, 7), red('pawn', 4, 6), black('rook', 4, 1)],
      steps: [{ accept: [move(1, 7, 4, 7)] }, { accept: [move(4, 7, 4, 1)] }],
      hint: 'Đưa Pháo sang cùng cột với quân Tốt đỏ và quân Xe đen.',
    },
  ],
}

export default cannonLesson
