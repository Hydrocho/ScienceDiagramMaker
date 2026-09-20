/**
 * Physics Diagram Presets (Korean Physics Exam Questions)
 */

export const PRESETS = [
  {
    id: 'freefall',
    title: '연직 운동 / 자유 낙하',
    desc: '높이 h에서 질량 m인 물체가 속력 v로 하강하는 다이어그램 (시험지 표준)',
    badge: '1',
    elements: [
      {
        id: 'ground_1',
        type: 'ground',
        x1: 60, y1: 360,
        x2: 540, y2: 360,
        hatchSide: 'bottom',
        hatchSize: 14
      },
      {
        id: 'dim_h',
        type: 'dimension',
        x1: 180, y1: 135,
        x2: 180, y2: 360,
        label: '높이 h',
        showGuides: false
      },
      {
        id: 'guide_h',
        type: 'guideLine',
        x1: 180, y1: 135,
        x2: 320, y2: 135,
        style: 'dashed'
      },
      {
        id: 'ball_1',
        type: 'ball',
        cx: 345, cy: 135,
        r: 25,
        label: '질량 m',
        showCenterDot: false,
        fill: '#ffffff'
      },
      {
        id: 'vec_v',
        type: 'vector',
        x1: 345, y1: 160,
        x2: 345, y2: 250,
        label: '속력 v',
        labelPos: 'right',
        strokeWidth: 2.2
      }
    ]
  },
  {
    id: 'inclined_plane',
    title: '빗면 운동 (Inclined Plane)',
    desc: '경사각 θ인 빗면 위에서 당기는 힘 F와 질량 m 물체',
    badge: '2',
    elements: [
      {
        id: 'ground_base',
        type: 'ground',
        x1: 75, y1: 345,
        x2: 480, y2: 345,
        hatchSide: 'bottom',
        hatchSize: 12
      },
      {
        id: 'ramp_line',
        type: 'guideLine',
        x1: 120, y1: 345,
        x2: 435, y2: 180,
        style: 'solid'
      },
      {
        id: 'ramp_wall',
        type: 'guideLine',
        x1: 435, y1: 180,
        x2: 435, y2: 345,
        style: 'solid'
      },
      {
        id: 'block_ramp',
        type: 'block',
        x: 240, y: 240,
        width: 60, height: 45,
        label: 'm',
        fill: '#ffffff'
      },
      {
        id: 'vec_force',
        type: 'vector',
        x1: 300, y1: 240,
        x2: 375, y2: 200,
        label: 'F',
        labelPos: 'top',
        strokeWidth: 2
      },
      {
        id: 'angle_theta',
        type: 'angleArc',
        cx: 120, cy: 345,
        r: 35,
        startAngle: 0, endAngle: 28,
        label: '\\theta'
      },
      {
        id: 'dim_ramp_h',
        type: 'dimension',
        x1: 465, y1: 180,
        x2: 465, y2: 345,
        label: 'h',
        showGuides: true
      }
    ]
  },
  {
    id: 'spring_mass',
    title: '용수철-질량 계 (Spring)',
    desc: '수평 바닥과 벽면에 연결된 용수철 상수 k와 질량 m',
    badge: '3',
    elements: [
      {
        id: 'wall_left',
        type: 'ground',
        x1: 105, y1: 150,
        x2: 105, y2: 345,
        hatchSide: 'left',
        hatchSize: 12
      },
      {
        id: 'ground_bottom',
        type: 'ground',
        x1: 105, y1: 345,
        x2: 495, y2: 345,
        hatchSide: 'bottom',
        hatchSize: 12
      },
      {
        id: 'spring_k',
        type: 'spring',
        x1: 105, y1: 300,
        x2: 285, y2: 300,
        coils: 10,
        radius: 12,
        label: 'k'
      },
      {
        id: 'block_m',
        type: 'block',
        x: 285, y: 255,
        width: 60, height: 90,
        label: 'm',
        fill: '#ffffff'
      },
      {
        id: 'disp_x',
        type: 'vector',
        x1: 285, y1: 225,
        x2: 360, y2: 225,
        label: 'x',
        labelPos: 'top',
        strokeWidth: 2
      }
    ]
  },
  {
    id: 'pulley_atwood',
    title: '애트우드 도르래 (Pulley)',
    desc: '천장에 고정된 도르래와 매달린 두 질량 m_1, m_2',
    badge: '4',
    elements: [
      {
        id: 'ceiling',
        type: 'ground',
        x1: 150, y1: 75,
        x2: 450, y2: 75,
        hatchSide: 'top',
        hatchSize: 12
      },
      {
        id: 'pulley_wheel',
        type: 'pulley',
        cx: 300, cy: 135,
        r: 30,
        label: ''
      },
      {
        id: 'rope_left',
        type: 'guideLine',
        x1: 270, y1: 135,
        x2: 270, y2: 255,
        style: 'solid'
      },
      {
        id: 'rope_right',
        type: 'guideLine',
        x1: 330, y1: 135,
        x2: 330, y2: 285,
        style: 'solid'
      },
      {
        id: 'block_m1',
        type: 'block',
        x: 240, y: 255,
        width: 60, height: 45,
        label: 'm_1',
        fill: '#ffffff'
      },
      {
        id: 'block_m2',
        type: 'block',
        x: 300, y: 285,
        width: 60, height: 45,
        label: 'm_2',
        fill: '#ffffff'
      },
      {
        id: 'vec_a1',
        type: 'vector',
        x1: 225, y1: 275,
        x2: 225, y2: 240,
        label: 'a',
        labelPos: 'left',
        strokeWidth: 2
      }
    ]
  },
  {
    id: 'collision',
    title: '1차원 충돌 (Collision)',
    desc: '수평면 위에서 마주보거나 따라가는 물체 m_A, m_B의 운동량 충돌',
    badge: '5',
    elements: [
      {
        id: 'ground_coll',
        type: 'ground',
        x1: 75, y1: 330,
        x2: 525, y2: 330,
        hatchSide: 'bottom',
        hatchSize: 12
      },
      {
        id: 'ball_A',
        type: 'ball',
        cx: 195, cy: 300,
        r: 30,
        label: 'm_A',
        showCenterDot: false,
        fill: '#ffffff'
      },
      {
        id: 'ball_B',
        type: 'ball',
        cx: 390, cy: 300,
        r: 30,
        label: 'm_B',
        showCenterDot: false,
        fill: '#ffffff'
      },
      {
        id: 'vec_vA',
        type: 'vector',
        x1: 195, y1: 255,
        x2: 270, y2: 255,
        label: 'v_A',
        labelPos: 'top',
        strokeWidth: 2
      },
      {
        id: 'vec_vB',
        type: 'vector',
        x1: 390, y1: 255,
        x2: 435, y2: 255,
        label: 'v_B',
        labelPos: 'top',
        strokeWidth: 2
      }
    ]
  }
];
