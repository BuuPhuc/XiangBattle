import { red, black, move } from '../helpers.js'

export const pawnLesson = {
  id: 'pawn',
  piece: 'pawn',
  title: 'Tốt',
  description: 'Đi thẳng từng ô; sau khi qua sông được đi ngang.',
  challenges: [
    {
      id: 'pawn-1',
      title: 'Tiến 1 ô',
      instruction: 'Tốt mỗi nước chỉ tiến thẳng 1 ô. Hãy đưa Tốt tiến lên ô được đánh dấu.',
      showMoves: true,
      pieces: [red('pawn', 4, 6)],
      steps: [{ accept: [move(4, 6, 4, 5)], target: [4, 5] }],
      hint: 'Tiến thẳng lên 1 ô.',
    },
    {
      id: 'pawn-2',
      title: 'Vượt sông',
      instruction: 'Tốt đang đứng sát bờ sông. Hãy đưa Tốt vượt sông sang ô được đánh dấu.',
      pieces: [red('pawn', 4, 5)],
      steps: [{ accept: [move(4, 5, 4, 4)], target: [4, 4] }],
      hint: 'Vượt sông cũng chỉ là một nước tiến thẳng 1 ô.',
    },
    {
      id: 'pawn-3',
      title: 'Đi ngang sau khi qua sông',
      instruction: 'Sau khi qua sông, Tốt được phép đi ngang 1 ô. Hãy đưa Tốt sang ô được đánh dấu.',
      showMoves: true,
      pieces: [red('pawn', 4, 4)],
      steps: [{ accept: [move(4, 4, 5, 4)], target: [5, 4] }],
      hint: 'Sang phải 1 ô.',
    },
    {
      id: 'pawn-4',
      title: 'Chưa qua sông',
      instruction: 'Khi chưa qua sông, Tốt chỉ được đi thẳng. Tốt đỏ có thể ăn quân Tốt đen nào?',
      pieces: [red('pawn', 2, 6), black('pawn', 3, 6), black('pawn', 2, 5)],
      steps: [
        {
          accept: [move(2, 6, 2, 5)],
          mistakes: [{ to: [3, 6], message: 'Tốt đỏ chưa qua sông nên chưa được đi ngang.' }],
        },
      ],
      hint: 'Tốt ăn quân theo đúng cách nó di chuyển.',
    },
    {
      id: 'pawn-5',
      title: 'Không đi lùi',
      instruction: 'Tốt không bao giờ được đi lùi. Tốt đỏ đã qua sông có thể ăn quân nào?',
      pieces: [red('pawn', 6, 3), black('horse', 6, 4), black('pawn', 7, 3)],
      steps: [
        {
          accept: [move(6, 3, 7, 3)],
          mistakes: [{ to: [6, 4], message: 'Quân Mã này nằm phía sau. Tốt không bao giờ được đi lùi.' }],
        },
      ],
      hint: 'Tốt đã qua sông: được tiến hoặc đi ngang.',
    },
    {
      id: 'pawn-6',
      title: 'Qua sông rồi rẽ ngang',
      instruction: 'Hãy dùng 2 nước đi để Tốt ăn quân Pháo đen: vượt sông trước, rồi mới đi ngang.',
      pieces: [red('pawn', 4, 5), black('cannon', 5, 4)],
      steps: [{ accept: [move(4, 5, 4, 4)] }, { accept: [move(4, 4, 5, 4)] }],
      hint: 'Tốt phải qua sông thì mới đi ngang được.',
    },
  ],
}

export default pawnLesson
