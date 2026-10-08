import { red, black, move } from '../helpers.js'

export const generalLesson = {
  id: 'general',
  piece: 'general',
  title: 'Tướng',
  description: 'Đi ngang hoặc dọc 1 ô và chỉ ở trong cung.',
  challenges: [
    {
      id: 'general-1',
      title: 'Tiến 1 ô',
      instruction: 'Tướng đi từng ô một, theo chiều ngang hoặc dọc. Hãy đưa Tướng tiến lên ô được đánh dấu.',
      showMoves: true,
      pieces: [red('general', 4, 9)],
      steps: [{ accept: [move(4, 9, 4, 8)], target: [4, 8] }],
      hint: 'Tiến thẳng lên 1 ô.',
    },
    {
      id: 'general-2',
      title: 'Đi ngang 1 ô',
      instruction: 'Hãy đưa Tướng sang ngang đến ô được đánh dấu.',
      pieces: [red('general', 4, 8)],
      steps: [{ accept: [move(4, 8, 3, 8)], target: [3, 8] }],
      hint: 'Sang trái 1 ô.',
    },
    {
      id: 'general-3',
      title: 'Tướng bắt quân',
      instruction: 'Quân Tốt đen đang chiếu Tướng. Tướng có thể tự ăn quân đứng sát bên — hãy dùng Tướng ăn quân Tốt.',
      pieces: [red('general', 4, 8), black('pawn', 4, 7)],
      steps: [{ accept: [move(4, 8, 4, 7)] }],
      hint: 'Quân Tốt đen đứng ngay phía trước Tướng.',
    },
    {
      id: 'general-4',
      title: 'Chỉ trong cung',
      instruction: 'Tướng không bao giờ được rời khỏi cung. Tướng đỏ có thể ăn quân nào?',
      pieces: [red('general', 5, 8), black('horse', 6, 8), black('pawn', 5, 7)],
      steps: [
        {
          accept: [move(5, 8, 5, 7)],
          mistakes: [{ to: [6, 8], message: 'Quân Mã này nằm ngoài cung. Tướng không được ra khỏi cung.' }],
        },
      ],
      hint: 'Chỉ xét quân nằm bên trong cung.',
    },
    {
      id: 'general-5',
      title: 'Không đối mặt Tướng',
      instruction:
        'Hai Tướng không được đối mặt nhau trên cùng một cột trống. Xe đen đang chiếu — hãy đưa Tướng đỏ đến ô an toàn.',
      pieces: [red('general', 4, 9), black('general', 5, 0), black('rook', 4, 2)],
      steps: [
        {
          accept: [move(4, 9, 3, 9)],
          mistakes: [
            { to: [5, 9], message: 'Ở ô này Tướng đỏ sẽ đối mặt trực tiếp với Tướng đen — nước đi không hợp lệ.' },
            { to: [4, 8], message: 'Tướng vẫn nằm trên cột của Xe đen nên vẫn bị chiếu.' },
          ],
        },
      ],
      hint: 'Tránh cột của Xe đen và tránh cả cột của Tướng đen.',
    },
    {
      id: 'general-6',
      title: 'Có quân chắn giữa',
      instruction:
        'Khi có quân chắn giữa hai Tướng thì không bị coi là đối mặt. Hãy dùng 2 nước đi đưa Tướng đến ô được đánh dấu.',
      pieces: [red('general', 5, 9), red('pawn', 4, 6), black('general', 4, 0)],
      steps: [
        { accept: [move(5, 9, 4, 9)], target: [3, 9] },
        { accept: [move(4, 9, 3, 9)], target: [3, 9] },
      ],
      hint: 'Quân Tốt đỏ đang chắn cột giữa, nên Tướng đi qua cột này được.',
    },
  ],
}

export default generalLesson
