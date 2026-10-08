import { red, black, move } from '../helpers.js'

export const elephantLesson = {
  id: 'elephant',
  piece: 'elephant',
  title: 'Tượng',
  description: 'Đi chéo đúng 2 ô và không được vượt sông.',
  challenges: [
    {
      id: 'elephant-1',
      title: 'Đi chéo 2 ô',
      instruction: 'Tượng đi chéo đúng 2 ô mỗi nước. Hãy đưa Tượng đến ô được đánh dấu.',
      showMoves: true,
      pieces: [red('elephant', 2, 9)],
      steps: [{ accept: [move(2, 9, 4, 7)], target: [4, 7] }],
      hint: 'Đi chéo lên bên phải đúng 2 ô.',
    },
    {
      id: 'elephant-2',
      title: 'Ra sát bờ sông',
      instruction: 'Hãy đưa Tượng tiếp tục đi chéo ra ô được đánh dấu ở sát bờ sông.',
      pieces: [red('elephant', 4, 7)],
      steps: [{ accept: [move(4, 7, 6, 5)], target: [6, 5] }],
      hint: 'Vẫn là một nước đi chéo đúng 2 ô.',
    },
    {
      id: 'elephant-3',
      title: 'Tượng bắt quân',
      instruction: 'Tượng ăn quân nằm ở cuối nước đi chéo 2 ô. Hãy dùng Tượng ăn quân Mã đen.',
      pieces: [red('elephant', 6, 9), black('horse', 8, 7)],
      steps: [{ accept: [move(6, 9, 8, 7)] }],
      hint: 'Quân Mã đen nằm chéo cách Tượng đúng 2 ô.',
    },
    {
      id: 'elephant-4',
      title: 'Không vượt sông',
      instruction: 'Tượng là quân phòng thủ và không bao giờ được vượt sông. Tượng đỏ có thể ăn quân Tốt đen nào?',
      pieces: [red('elephant', 2, 5), black('pawn', 4, 3), black('pawn', 4, 7)],
      steps: [
        {
          accept: [move(2, 5, 4, 7)],
          mistakes: [{ to: [4, 3], message: 'Quân Tốt này ở bên kia sông. Tượng không được vượt sông.' }],
        },
      ],
      hint: 'Chỉ xét những quân nằm ở nửa bàn cờ phía dưới.',
    },
    {
      id: 'elephant-5',
      title: 'Chặn mắt Tượng',
      instruction:
        'Nếu ô chéo ở giữa đường đi ("mắt Tượng") có quân đứng, Tượng không đi được hướng đó. Tượng đỏ có thể ăn quân Tốt đen nào?',
      pieces: [red('elephant', 4, 7), red('pawn', 3, 6), black('pawn', 2, 5), black('pawn', 6, 5)],
      steps: [
        {
          accept: [move(4, 7, 6, 5)],
          mistakes: [{ to: [2, 5], message: 'Quân Tốt đỏ đang đứng ở mắt Tượng nên Tượng không đi được hướng này.' }],
        },
      ],
      hint: 'Hãy nhìn ô chéo ngay cạnh Tượng ở mỗi hướng — ô nào còn trống?',
    },
    {
      id: 'elephant-6',
      title: 'Đổi cánh',
      instruction: 'Hãy dùng 2 nước đi để đưa Tượng sang ô được đánh dấu ở cánh bên kia.',
      pieces: [red('elephant', 2, 9)],
      steps: [
        { accept: [move(2, 9, 4, 7)], target: [6, 9] },
        { accept: [move(4, 7, 6, 9)], target: [6, 9] },
      ],
      hint: 'Tượng phải đi qua ô chính giữa phía trên cung.',
    },
  ],
}

export default elephantLesson
