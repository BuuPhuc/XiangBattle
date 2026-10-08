import { red, black, move } from '../helpers.js'

export const advisorLesson = {
  id: 'advisor',
  piece: 'advisor',
  title: 'Sĩ',
  description: 'Đi chéo 1 ô và chỉ ở trong cung.',
  challenges: [
    {
      id: 'advisor-1',
      title: 'Đi chéo 1 ô',
      instruction: 'Sĩ đi chéo 1 ô mỗi nước, theo các đường chéo trong cung. Hãy đưa Sĩ lên ô giữa cung.',
      showMoves: true,
      pieces: [red('advisor', 3, 9)],
      steps: [{ accept: [move(3, 9, 4, 8)], target: [4, 8] }],
      hint: 'Đi chéo lên bên phải 1 ô.',
    },
    {
      id: 'advisor-2',
      title: 'Lên góc cung',
      instruction: 'Từ giữa cung, Sĩ có thể đi tới cả 4 góc. Hãy đưa Sĩ đến ô được đánh dấu.',
      pieces: [red('advisor', 4, 8)],
      steps: [{ accept: [move(4, 8, 5, 7)], target: [5, 7] }],
      hint: 'Đi chéo lên bên phải 1 ô.',
    },
    {
      id: 'advisor-3',
      title: 'Sĩ bắt quân',
      instruction: 'Sĩ ăn quân nằm ở ô chéo sát bên. Hãy dùng Sĩ ăn quân Mã đen.',
      pieces: [red('advisor', 4, 8), black('horse', 3, 7)],
      steps: [{ accept: [move(4, 8, 3, 7)] }],
      hint: 'Quân Mã đen nằm ở ô chéo phía trên bên trái.',
    },
    {
      id: 'advisor-4',
      title: 'Chỉ trong cung',
      instruction: 'Sĩ không bao giờ được rời khỏi cung. Sĩ đỏ có thể ăn quân Tốt đen nào?',
      pieces: [red('advisor', 5, 7), black('pawn', 6, 6), black('pawn', 4, 8)],
      steps: [
        {
          accept: [move(5, 7, 4, 8)],
          mistakes: [{ to: [6, 6], message: 'Quân Tốt này nằm ngoài cung. Sĩ không được ra khỏi cung.' }],
        },
      ],
      hint: 'Cung là khu vực 3×3 có hai đường chéo.',
    },
    {
      id: 'advisor-5',
      title: 'Chỉ đi chéo',
      instruction: 'Sĩ chỉ đi chéo, không đi thẳng hay đi ngang. Sĩ đỏ có thể ăn quân Tốt đen nào?',
      pieces: [red('advisor', 4, 8), black('pawn', 4, 7), black('pawn', 5, 7)],
      steps: [
        {
          accept: [move(4, 8, 5, 7)],
          mistakes: [{ to: [4, 7], message: 'Quân Tốt này nằm thẳng phía trước. Sĩ chỉ đi chéo.' }],
        },
      ],
      hint: 'Tìm quân Tốt nằm ở ô chéo so với Sĩ.',
    },
    {
      id: 'advisor-6',
      title: 'Đổi góc',
      instruction: 'Hãy dùng 2 nước đi để đưa Sĩ sang ô được đánh dấu ở góc bên kia.',
      pieces: [red('advisor', 3, 9)],
      steps: [
        { accept: [move(3, 9, 4, 8)], target: [5, 9] },
        { accept: [move(4, 8, 5, 9)], target: [5, 9] },
      ],
      hint: 'Sĩ phải đi qua ô giữa cung.',
    },
  ],
}

export default advisorLesson
