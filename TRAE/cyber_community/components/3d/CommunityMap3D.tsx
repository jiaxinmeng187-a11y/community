"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { cn } from '@/lib/utils'

// ════════════════════════════════════════
//  类型
// ════════════════════════════════════════

interface BuildingData {
  id: string
  name: string
  posX: number
  posZ: number
  alertLevel: 'normal' | 'low' | 'mid' | 'high'
  hasPendingTickets: boolean
}

interface TicketData {
  id: string
  description: string
  status: 'pending' | 'processing' | 'done'
  aiSeverity: 'low' | 'mid' | 'high'
}

interface CommunityMap3DProps {
  role: 'resident' | 'admin'
  residentInfo?: {
    buildingName: string
    posX: number
    posZ: number
    unitNumber: string | null
    apartmentNumber: string | null
  } | null
  /** 管理端：从 API 加载的工单列表 */
  tickets?: Array<{
    id: string
    buildingName: string | null
    buildingId: string | null
    unitNumber: string | null
    apartmentNumber: string | null
    reporterName: string | null
    description: string | null
    imageUrl: string | null
    aiSeverity: string
    status: string
    createdAt: string | null
  }> | null
  /** 管理端：外部触发的聚焦工单 ID（如从工单列表点"查看详情"） */
  focusTicketId?: string | null
  onFocusComplete?: () => void
  /** 居民端：AI 识别上报的工单 */
  reportedTickets?: Array<{
    id: string
    description: string
    posX: number
    posZ: number
    buildingName: string
    severity: string
  }> | null
  /** 居民端：从数据库加载的报修记录 */
  residentTickets?: Array<{
    id: string
    title: string | null
    description: string | null
    buildingName: string | null
    aiSeverity: string
    status: string
    createdAt: string | null
  }> | null
}

// ════════════════════════════════════════
//  Mock 数据
// ════════════════════════════════════════

const mockBuildings: BuildingData[] = [
  { id: '1',  name: '1栋',       posX: -30, posZ: -30, alertLevel: 'normal', hasPendingTickets: false },
  { id: '2',  name: '2栋',       posX: -10, posZ: -30, alertLevel: 'high',   hasPendingTickets: true },
  { id: '3',  name: '3栋',       posX:  10, posZ: -30, alertLevel: 'mid',    hasPendingTickets: true },
  { id: '4',  name: '4栋',       posX:  30, posZ: -30, alertLevel: 'normal', hasPendingTickets: false },
  { id: '5',  name: '5栋',       posX: -30, posZ:   0, alertLevel: 'normal', hasPendingTickets: false },
  { id: '6',  name: '6栋',       posX: -10, posZ:   0, alertLevel: 'normal', hasPendingTickets: false },
  { id: '7',  name: '7栋',       posX:  10, posZ:   0, alertLevel: 'high',   hasPendingTickets: true },
  { id: '8',  name: '8栋',       posX:  30, posZ:   0, alertLevel: 'normal', hasPendingTickets: false },
  { id: '9',  name: '9栋',       posX: -30, posZ:  30, alertLevel: 'normal', hasPendingTickets: false },
  { id: '10', name: '10栋',      posX: -10, posZ:  30, alertLevel: 'mid',    hasPendingTickets: true },
  { id: '11', name: '11栋',      posX:  10, posZ:  30, alertLevel: 'normal', hasPendingTickets: false },
  { id: '12', name: '12栋',      posX:  30, posZ:  30, alertLevel: 'normal', hasPendingTickets: false },
  { id: '13', name: '物业中心',   posX:   0, posZ:  45, alertLevel: 'normal', hasPendingTickets: false },
  { id: '14', name: '东门保安亭', posX:  45, posZ:   0, alertLevel: 'normal', hasPendingTickets: false },
  { id: '15', name: '西门保安亭', posX: -45, posZ:   0, alertLevel: 'normal', hasPendingTickets: false },
]

const SCALE = 0.25

// ════════════════════════════════════════
//  样式映射
// ════════════════════════════════════════

const statusLabels: Record<string, string> = { pending: '已上报', processing: '待分配', assigned: '已分配', done: '已完成' }
const statusColors: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700', processing: 'bg-amber-100 text-amber-700', assigned: 'bg-purple-100 text-purple-700', done: 'bg-green-100 text-green-700',
}

// 进度条阶段定义
const PROGRESS_STAGES = ['已上报', '待分配', '已分配', '已完成']
const STATUS_TO_STAGE: Record<string, number> = { pending: 0, processing: 1, assigned: 2, done: 3 }
const severityLabels: Record<string, string> = { low: '轻微', mid: '中等', high: '紧急' }
const severityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700', mid: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700',
}
const alertLevelLabels: Record<string, string> = { normal: '正常', low: '轻微', mid: '中等', high: '紧急' }
const alertLevelTagColors: Record<string, string> = {
  normal: 'bg-green-100 text-green-700', low: 'bg-green-100 text-green-700', mid: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700',
}

const ALERT_COLORS: Record<string, { hex: number; speed: number; amp: number; base: number }> = {
  high:   { hex: 0xdc2626, speed: 4.0, amp: 0.35, base: 0.2 },
  mid:    { hex: 0xd97706, speed: 2.5, amp: 0.25, base: 0.12 },
  low:    { hex: 0x16a34a, speed: 1.6, amp: 0.18, base: 0.06 },
  normal: { hex: 0x000000, speed: 0,    amp: 0,    base: 0 },
}

// ════════════════════════════════════════
//  共享材质缓存（用 useMemo 避免了，此处仅初始化）
// ════════════════════════════════════════

const asphaltMat = new THREE.MeshStandardMaterial({ color: '#4a4a4f', roughness: 0.92, metalness: 0.05 })
const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#c8bfb0', roughness: 0.75, metalness: 0.05 })
const curbMat = new THREE.MeshStandardMaterial({ color: '#8a8a80', roughness: 0.65, metalness: 0.1 })
const lineMat = new THREE.MeshStandardMaterial({ color: '#e8d88a', roughness: 0.5, metalness: 0 })
const fenceMat = new THREE.MeshStandardMaterial({ color: '#c8c0b8', roughness: 0.5, metalness: 0.3 })
const fencePillarMat = new THREE.MeshStandardMaterial({ color: '#d0ccc4', roughness: 0.45, metalness: 0.2 })
const lampPoleMat = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.4, metalness: 0.6 })
const lampGlowMat = new THREE.MeshStandardMaterial({ color: '#fff8dc', roughness: 0.2, emissive: '#fff8dc', emissiveIntensity: 0.3 })

// ════════════════════════════════════════
//  地面系统
// ════════════════════════════════════════

/** 微起伏草地 */
function Ground() {
  const geoRef = useRef<THREE.PlaneGeometry>(null)
  useEffect(() => {
    const geo = geoRef.current
    if (!geo) return
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i)
      const z = Math.sin(x * 0.35) * Math.cos(y * 0.35) * 0.25 + Math.sin(x * 0.7 + y * 0.5) * 0.12 + Math.cos(x * 0.5 - y * 0.7) * 0.1
      pos.setZ(i, z)
    }
    geo.computeVertexNormals()
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.1} receiveShadow>
      <planeGeometry ref={geoRef} args={[26, 26, 50, 50]} />
      <meshStandardMaterial color="#7a9e5a" roughness={0.98} metalness={0} />
    </mesh>
  )
}

// ════════════════════════════════════════
//  道路系统（沥青 + 路沿 + 人行道 + 标线）
// ════════════════════════════════════════

function RoadSegment({ pos, size, rot }: { pos: [number, number, number]; size: [number, number]; rot?: number }) {
  return (
    <group position={pos} rotation-y={rot ?? 0}>
      {/* 沥青 */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.03} receiveShadow>
        <planeGeometry args={size} />
        <primitive object={asphaltMat} attach="material" />
      </mesh>
      {/* 路沿 */}
      <mesh position={[0, 0.07, size[1] / 2 - 0.15]} receiveShadow castShadow>
        <boxGeometry args={[size[0], 0.08, 0.25]} />
        <primitive object={curbMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.07, -size[1] / 2 + 0.15]} receiveShadow castShadow>
        <boxGeometry args={[size[0], 0.08, 0.25]} />
        <primitive object={curbMat} attach="material" />
      </mesh>
      {/* 人行道 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.1, size[1] / 2 + 0.55]} receiveShadow>
        <planeGeometry args={[size[0], 0.8]} />
        <primitive object={sidewalkMat} attach="material" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.1, -size[1] / 2 - 0.55]} receiveShadow>
        <planeGeometry args={[size[0], 0.8]} />
        <primitive object={sidewalkMat} attach="material" />
      </mesh>
      {/* 道路标线 */}
      {Array.from({ length: Math.floor(size[0] / 1.5) }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[i * 1.5 - size[0] / 2 + 0.75, 0.05, 0]} receiveShadow>
          <planeGeometry args={[0.8, 0.08]} />
          <primitive object={lineMat} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

function CrossRoad({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      {/* 横向路 */}
      <RoadSegment pos={[0, 0, 0]} size={[13.5, 1.8]} />
      {/* 竖向路 */}
      <RoadSegment pos={[0, 0, 0]} size={[13.5, 1.8]} rot={Math.PI / 2} />
    </group>
  )
}

// ════════════════════════════════════════
//  围墙系统
// ════════════════════════════════════════

function WallSegment({ start, end }: { start: [number, number]; end: [number, number] }) {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const len = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)
  const mx = (start[0] + end[0]) / 2
  const mz = (start[1] + end[1]) / 2

  return (
    <group position={[mx, 0.5, mz]} rotation-y={angle}>
      <mesh position-y={0} receiveShadow castShadow>
        <boxGeometry args={[len, 0.7, 0.15]} />
        <primitive object={fenceMat} attach="material" />
      </mesh>
      {Array.from({ length: Math.floor(len / 0.5) + 1 }).map((_, i) => (
        <mesh key={i} position={[-len / 2 + i * 0.5 + (i === 0 ? 0.25 : 0), 0.55, 0]} castShadow>
          <boxGeometry args={[0.2, 0.4, 0.2]} />
          <primitive object={fencePillarMat} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

function PerimeterWall() {
  const walls: { s: [number, number]; e: [number, number] }[] = [
    { s: [-12, -12.5], e: [12, -12.5] },
    { s: [12, -12.5], e: [12, 12.5] },
    { s: [12, 12.5], e: [-12, 12.5] },
    { s: [-12, 12.5], e: [-12, -12.5] },
  ]
  return <>{walls.map((w, i) => <WallSegment key={i} start={w.s} end={w.e} />)}</>
}

// ════════════════════════════════════════
//  树（三种类型）
// ════════════════════════════════════════

function TreeTypeA({ position, scale }: { position: [number, number, number]; scale?: number }) {
  const s = scale ?? 1
  return (
    <group position={position} scale={s}>
      <mesh position-y={0.5} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 1.0, 8]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      <mesh position-y={1.2} castShadow>
        <sphereGeometry args={[0.7, 8, 6]} />
        <meshStandardMaterial color="#5a8a3c" roughness={0.9} />
      </mesh>
    </group>
  )
}

function TreeTypeB({ position, scale }: { position: [number, number, number]; scale?: number }) {
  const s = scale ?? 1
  return (
    <group position={position} scale={s}>
      <mesh position-y={0.7} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 1.4, 8]} />
        <meshStandardMaterial color="#6B5520" roughness={0.9} />
      </mesh>
      <mesh position-y={1.8} castShadow>
        <coneGeometry args={[0.5, 1.8, 10, 4]} />
        <meshStandardMaterial color="#4a7a3a" roughness={0.85} />
      </mesh>
      <mesh position-y={2.5} castShadow>
        <coneGeometry args={[0.35, 1.2, 8, 4]} />
        <meshStandardMaterial color="#5a8a45" roughness={0.85} />
      </mesh>
    </group>
  )
}

function TreeTypeC({ position, scale }: { position: [number, number, number]; scale?: number }) {
  const s = scale ?? 1
  return (
    <group position={position} scale={s}>
      <mesh position-y={0.4} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.8, 6]} />
        <meshStandardMaterial color="#9a7a4a" roughness={0.85} />
      </mesh>
      <mesh position-y={1.1} castShadow>
        <coneGeometry args={[0.6, 1.5, 12, 5]} />
        <meshStandardMaterial color="#3a6a2a" roughness={0.85} />
      </mesh>
      <mesh position-y={1.7} castShadow>
        <coneGeometry args={[0.4, 1.0, 10, 5]} />
        <meshStandardMaterial color="#4a7a3a" roughness={0.85} />
      </mesh>
    </group>
  )
}

function Bush({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.15} castShadow receiveShadow>
        <sphereGeometry args={[0.35, 8, 6]} />
        <meshStandardMaterial color="#4a7a3a" roughness={0.85} />
      </mesh>
      <mesh position={[0.2, 0.2, 0.1]} castShadow>
        <sphereGeometry args={[0.25, 6, 5]} />
        <meshStandardMaterial color="#5a8a45" roughness={0.85} />
      </mesh>
    </group>
  )
}

function Trees() {
  const trees = useMemo(() => {
    const result: Array<{ pos: [number, number, number]; type: number; scale: number }> = []
    const add = (x: number, z: number) => {
      const type = Math.floor(Math.random() * 3)
      const scale = 0.7 + Math.random() * 0.8
      const offsetX = (Math.random() - 0.5) * 1.5
      const offsetZ = (Math.random() - 0.5) * 1.5
      result.push({ pos: [(x + offsetX) * SCALE, 0, (z + offsetZ) * SCALE], type, scale })
    }
    // 四个象限 + 边缘大量散落
    const spots: [number, number][] = []
    // 四个角落区域密集种植
    for (let i = 0; i < 8; i++) { spots.push([-40 + Math.random() * 12, -40 + Math.random() * 12]) }
    for (let i = 0; i < 8; i++) { spots.push([28 + Math.random() * 12, -40 + Math.random() * 12]) }
    for (let i = 0; i < 8; i++) { spots.push([-40 + Math.random() * 12, 28 + Math.random() * 12]) }
    for (let i = 0; i < 8; i++) { spots.push([28 + Math.random() * 12, 28 + Math.random() * 12]) }
    // 道路两侧
    const roadPairs: [number, number][] = [[-20, -20], [-20, 20], [20, -20], [20, 20], [-8, -22], [8, -22], [-8, 22], [8, 22], [-22, -8], [-22, 8], [22, -8], [22, 8]]
    roadPairs.forEach(([x, z]) => spots.push([x, z]))
    // 楼间绿化
    for (let i = 0; i < 12; i++) { spots.push([-20 + Math.random() * 40, -20 + Math.random() * 40]) }
    spots.forEach(([x, z]) => add(x, z))
    return result
  }, [])

  return (
    <>
      {trees.map((t, i) => {
        if (t.type === 0) return <TreeTypeA key={`a${i}`} position={t.pos} scale={t.scale} />
        if (t.type === 1) return <TreeTypeB key={`b${i}`} position={t.pos} scale={t.scale} />
        return <TreeTypeC key={`c${i}`} position={t.pos} scale={t.scale} />
      })}
    </>
  )
}

// ════════════════════════════════════════
//  路灯
// ════════════════════════════════════════

function StreetLamp({ position }: { position: [number, number, number] }) {
  const [x, y, z] = position
  return (
    <group position={[x, y, z]} castShadow>
      <mesh position-y={1.8}>
        <cylinderGeometry args={[0.06, 0.06, 3.6, 8]} />
        <primitive object={lampPoleMat} attach="material" />
      </mesh>
      <group position={[0, 3.8, -0.6]}>
        <mesh rotation-x={0.3}>
          <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
          <primitive object={lampPoleMat} attach="material" />
        </mesh>
        <mesh position={[0, -0.3, -0.25]}>
          <sphereGeometry args={[0.2, 8, 6]} />
          <primitive object={lampGlowMat} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

// ════════════════════════════════════════
//  花坛
// ════════════════════════════════════════

function FlowerBed({ position, radius }: { position: [number, number, number]; radius?: number }) {
  const r = radius ?? 0.8
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05} receiveShadow>
        <circleGeometry args={[r, 16]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.9} />
      </mesh>
      <mesh position-y={0.08} receiveShadow>
        <cylinderGeometry args={[r, r, 0.05, 16]} />
        <meshStandardMaterial color="#c8b090" roughness={0.7} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a) * r * 0.6, 0.2, Math.sin(a) * r * 0.6]}>
            <mesh castShadow>
              <sphereGeometry args={[0.12, 6, 4]} />
              <meshStandardMaterial color={['#ff6b8a', '#ffa64d', '#ffdd57', '#e8739a', '#87ceeb'][i]} roughness={0.7} />
            </mesh>
            <mesh position-y={0.1}>
              <cylinderGeometry args={[0.02, 0.02, 0.2, 4]} />
              <meshStandardMaterial color="#5a8a3a" roughness={0.8} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ════════════════════════════════════════
//  长凳
// ════════════════════════════════════════

function Bench({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation-y={rotation} castShadow>
      <mesh position-y={0.25}>
        <boxGeometry args={[1.6, 0.08, 0.35]} />
        <meshStandardMaterial color="#b08968" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position-y={0.12}>
        <boxGeometry args={[1.6, 0.05, 0.4]} />
        <meshStandardMaterial color="#8a6540" roughness={0.5} metalness={0.1} />
      </mesh>
      {[[-0.65, 0, 0.12], [0.65, 0, 0.12], [-0.65, 0, -0.12], [0.65, 0, -0.12]].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, 0.12, lz]}>
          <boxGeometry args={[0.08, 0.25, 0.08]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ════════════════════════════════════════
//  停车场
// ════════════════════════════════════════

function ParkedCar({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const c = ['#e8e0d0', '#d0c8b8', '#c8d0d8', '#e0d8c8', '#d8d0c0'][Math.floor(Math.random() * 5)]
  return (
    <group position={position} rotation-y={rotation} castShadow>
      <mesh position-y={0.4}>
        <boxGeometry args={[1.2, 0.6, 2.0]} />
        <meshStandardMaterial color={c} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.8, -0.3]}>
        <boxGeometry args={[1.0, 0.25, 1.2]} />
        <meshStandardMaterial color="#c8e8ff" roughness={0.1} metalness={0.1} opacity={0.35} transparent />
      </mesh>
      {[[-0.55, 0.2, 0.7], [0.55, 0.2, 0.7], [-0.55, 0.2, -0.7], [0.55, 0.2, -0.7]].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, ly, lz]}>
          <cylinderGeometry args={[0.2, 0.2, 0.15, 12]} />
          <meshStandardMaterial color="#222" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function ParkingLot({ position }: { position: [number, number, number] }) {
  const spots = [
    [-1.2, 0], [0, 0], [1.2, 0],
    [-1.2, 2.5], [0, 2.5], [1.2, 2.5],
  ]
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <planeGeometry args={[4.5, 5.5]} />
        <meshStandardMaterial color="#708090" roughness={0.75} />
      </mesh>
      {spots.map(([x, z], i) => (
        <ParkedCar key={i} position={[x, 0, z - 0.5]} rotation={0} />
      ))}
    </group>
  )
}

// ════════════════════════════════════════
//  小区大门
// ════════════════════════════════════════

function CommunityGate({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 底座 */}
      <mesh position-y={0.2} castShadow>
        <boxGeometry args={[5.0, 0.35, 1.5]} />
        <meshStandardMaterial color="#c0b8a8" roughness={0.5} />
      </mesh>
      {/* 左柱 */}
      <mesh position={[-2.0, 2.0, 0]} castShadow>
        <boxGeometry args={[0.8, 4.0, 0.8]} />
        <meshStandardMaterial color="#d8d0c4" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* 右柱 */}
      <mesh position={[2.0, 2.0, 0]} castShadow>
        <boxGeometry args={[0.8, 4.0, 0.8]} />
        <meshStandardMaterial color="#d8d0c4" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* 横梁 */}
      <mesh position={[0, 4.1, 0]} castShadow>
        <boxGeometry args={[5.2, 0.3, 1.0]} />
        <meshStandardMaterial color="#b8a890" roughness={0.4} metalness={0.15} />
      </mesh>
      {/* 门牌 */}
      <mesh position={[0, 4.35, 0.55]} castShadow>
        <boxGeometry args={[3.5, 0.5, 0.1]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.1} />
      </mesh>
      <Html position={[0, 4.35, 0.62]} center style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', background: 'transparent', letterSpacing: '2px' }}>
          阳光社区
        </div>
      </Html>
    </group>
  )
}

// ════════════════════════════════════════
//  真实感居民楼（窗户 + 阳台 + 屋顶设施）
// ════════════════════════════════════════

function ResidentialBuilding({
  def, onHover, onUnhover, onClick,
}: {
  def: BuildingData
  onHover: (b: BuildingData, e: THREE.Event) => void
  onUnhover: () => void
  onClick: (b: BuildingData) => void
}) {
  const bodyRef = useRef<THREE.Mesh>(null)
  const cfg = ALERT_COLORS[def.alertLevel]
  const isFacility = !def.name.includes('栋')

  const seed = parseInt(def.id) % 100
  const floors = isFacility ? 2 : 6 + (seed % 3)  // 6-8 层
  const w = isFacility ? 1.6 : 2.4
  const d = isFacility ? 1.2 : 2.0
  const floorH = 0.55
  const h = floors * floorH
  const x = def.posX * SCALE
  const z = def.posZ * SCALE

  useFrame(({ clock }) => {
    if (cfg.speed > 0 && bodyRef.current) {
      const t = clock.getElapsedTime()
      const intensity = cfg.base + cfg.amp * (0.5 + 0.5 * Math.sin(t * cfg.speed + seed))
      ;(bodyRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity
    }
  })

  const emissiveColor = useMemo(() => new THREE.Color(cfg.hex), [cfg.hex])
  const bodyColor = isFacility ? '#e8ddd0' : '#f0e8dc'
  const balconyColor = '#e8dcd0'
  const windowFrameColor = '#888899'

  return (
    <group>
      {/* === 楼体 === */}
      <mesh
        ref={bodyRef}
        position={[x, h / 2 + 0.2, z]}
        castShadow receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); onHover(def, e) }}
        onPointerOut={onUnhover}
        onClick={(e) => { e.stopPropagation(); onClick(def) }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.05} emissive={emissiveColor} emissiveIntensity={cfg.base} />
      </mesh>

      {/* === 每层 窗户 + 阳台 === */}
      {Array.from({ length: floors }).map((_, fi) => {
        const baseY = 0.2 + fi * floorH + floorH / 2
        const elements: React.ReactNode[] = []

        // 正面窗户（2 列）
        ;[-0.55, 0.55].forEach((ox, wi) => {
          elements.push(
            <group key={`w-f-${fi}-${wi}`}>
              <mesh position={[x + ox * (w / 2 - 0.04), baseY, z + d / 2 + 0.02]} castShadow>
                <boxGeometry args={[0.35, 0.3, 0.04]} />
                <meshStandardMaterial color={windowFrameColor} roughness={0.3} metalness={0.5} emissive={emissiveColor} emissiveIntensity={cfg.base * 0.15} />
              </mesh>
              <mesh position={[x + ox * (w / 2 - 0.04), baseY, z + d / 2 + 0.05]}>
                <boxGeometry args={[0.36, 0.03, 0.015]} />
                <meshStandardMaterial color="#666670" roughness={0.3} metalness={0.6} />
              </mesh>
              <mesh position={[x + ox * (w / 2 - 0.04), baseY, z + d / 2 + 0.05]}>
                <boxGeometry args={[0.03, 0.31, 0.015]} />
                <meshStandardMaterial color="#666670" roughness={0.3} metalness={0.6} />
              </mesh>
            </group>,
          )
        })

        // 背面窗户
        ;[-0.55, 0.55].forEach((ox, wi) => {
          elements.push(
            <group key={`w-b-${fi}-${wi}`}>
              <mesh position={[x + ox * (w / 2 - 0.04), baseY, z - d / 2 - 0.02]} castShadow>
                <boxGeometry args={[0.35, 0.3, 0.04]} />
                <meshStandardMaterial color={windowFrameColor} roughness={0.3} metalness={0.5} emissive={emissiveColor} emissiveIntensity={cfg.base * 0.15} />
              </mesh>
            </group>,
          )
        })

        // 侧面窗户
        if (!isFacility) {
          ;[-0.45, 0, 0.45].forEach((ox, wi) => {
            elements.push(
              <group key={`w-s-${fi}-${wi}`}>
                <mesh position={[x - w / 2 - 0.02, baseY, z + ox]} castShadow>
                  <boxGeometry args={[0.04, 0.28, 0.3]} />
                  <meshStandardMaterial color={windowFrameColor} roughness={0.3} metalness={0.5} />
                </mesh>
                <mesh position={[x + w / 2 + 0.02, baseY, z + ox]} castShadow>
                  <boxGeometry args={[0.04, 0.28, 0.3]} />
                  <meshStandardMaterial color={windowFrameColor} roughness={0.3} metalness={0.5} />
                </mesh>
              </group>,
            )
          })
        }

        // 正面阳台（每 2 层一个凸出阳台）
        if (!isFacility && fi % 2 === 0) {
          elements.push(
            <group key={`bal-${fi}`}>
              <mesh position={[x, baseY - 0.1, z + d / 2 + 0.35]} castShadow>
                <boxGeometry args={[w - 0.3, 0.15, 0.6]} />
                <meshStandardMaterial color={balconyColor} roughness={0.5} />
              </mesh>
              <mesh position={[x, baseY + 0.15, z + d / 2 + 0.62]} castShadow>
                <boxGeometry args={[w - 0.3, 0.35, 0.03]} />
                <meshStandardMaterial color="#aab0bb" roughness={0.3} metalness={0.5} />
              </mesh>
              {[-0.8, -0.3, 0.3, 0.8].map((ox, bi) => (
                <mesh key={`br-${bi}`} position={[x + ox, baseY, z + d / 2 + 0.62]}>
                  <boxGeometry args={[0.03, 0.4, 0.03]} />
                  <meshStandardMaterial color="#aab0bb" roughness={0.3} metalness={0.5} />
                </mesh>
              ))}
            </group>,
          )
        }

        return elements
      })}

      {/* === 屋顶 === */}
      <mesh position={[x, h + 0.25, z]} castShadow>
        <boxGeometry args={[w + 0.2, 0.3, d + 0.2]} />
        <meshStandardMaterial color="#555560" roughness={0.5} metalness={0.15} />
      </mesh>

      {/* === 屋顶设施：水箱 === */}
      {!isFacility && (
        <>
          <mesh position={[x - 0.4, h + 0.75, z + 0.3]} castShadow>
            <cylinderGeometry args={[0.25, 0.3, 0.7, 12]} />
            <meshStandardMaterial color="#888" roughness={0.4} metalness={0.4} />
          </mesh>
          {/* 太阳能热水器 */}
          <mesh position={[x + 0.5, h + 0.55, z - 0.3]} castShadow>
            <boxGeometry args={[0.8, 0.2, 1.2]} />
            <meshStandardMaterial color="#334466" roughness={0.15} metalness={0.5} />
          </mesh>
          <mesh position={[x + 0.5, h + 0.9, z - 0.3]} rotation-x={0.4} castShadow>
            <boxGeometry args={[0.7, 0.04, 1.0]} />
            <meshStandardMaterial color="#446688" roughness={0.1} metalness={0.3} />
          </mesh>
        </>
      )}

      {/* === 入口雨棚 === */}
      {!isFacility && (
        <group position={[x, 1.2, z + d / 2 + 0.4]}>
          <mesh rotation-x={-0.3} castShadow>
            <boxGeometry args={[1.2, 0.06, 0.7]} />
            <meshStandardMaterial color="#7788aa" roughness={0.3} metalness={0.2} />
          </mesh>
          {[[-0.5, 0], [0.5, 0]].map(([ox, oz], i) => (
            <mesh key={`rp-${i}`} position={[ox, -0.35, oz]}>
              <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
              <meshStandardMaterial color="#666" roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}

      {/* === 平台/地基 === */}
      <mesh position={[x, 0.1, z]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.5, 0.15, d + 0.5]} />
        <meshStandardMaterial color="#a8a098" roughness={0.7} />
      </mesh>

      {/* === 楼栋名称标签 === */}
      <Html position={[x, h + 1.2, z]} center style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: '10px', whiteSpace: 'nowrap', letterSpacing: '1px' }}>
          {def.name}
        </div>
      </Html>
    </group>
  )
}

// ════════════════════════════════════════
//  告警粒子
// ════════════════════════════════════════

function AlertParticles({ buildings }: { buildings: BuildingData[] }) {
  const particlesRef = useRef<THREE.Points>(null)
  const particleData = useRef<Array<{ position: THREE.Vector3; velocity: THREE.Vector3; life: number; color: THREE.Color }>>([])
  const MAX = 400

  const [positions, colors, sizes] = useMemo(() => [new Float32Array(MAX * 3), new Float32Array(MAX * 3), new Float32Array(MAX)], [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1))
    return g
  }, [])
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }), [])

  useFrame((_, delta) => {
    buildings.forEach(b => {
      const cfg = ALERT_COLORS[b.alertLevel]
      if (cfg.speed > 0 && Math.random() < 0.3) {
        const isF = !b.name.includes('栋')
        const floors = isF ? 2 : 6 + (parseInt(b.id) % 3)
        const bh = floors * 0.55
        particleData.current.push({
          position: new THREE.Vector3(b.posX * SCALE + (Math.random() - 0.5) * 2.5, bh + 0.3 + Math.random() * 0.8, b.posZ * SCALE + (Math.random() - 0.5) * 2.5),
          velocity: new THREE.Vector3((Math.random() - 0.5) * 0.005, 0.015 + Math.random() * 0.02, (Math.random() - 0.5) * 0.005),
          life: 1, color: new THREE.Color(cfg.hex),
        })
      }
    })
    const data = particleData.current
    for (let i = data.length - 1; i >= 0; i--) {
      data[i].life -= delta * 1.2
      data[i].position.add(data[i].velocity)
      if (data[i].life <= 0) data.splice(i, 1)
    }
    for (let i = 0; i < MAX; i++) {
      if (i < data.length) {
        const p = data[i]
        positions[i * 3] = p.position.x; positions[i * 3 + 1] = p.position.y; positions[i * 3 + 2] = p.position.z
        colors[i * 3] = p.color.r * p.life; colors[i * 3 + 1] = p.color.g * p.life; colors[i * 3 + 2] = p.color.b * p.life
        sizes[i] = 0.12 * p.life
      } else {
        positions[i * 3] = 0; positions[i * 3 + 1] = -100; positions[i * 3 + 2] = 0; sizes[i] = 0
      }
    }
    if (particlesRef.current) {
      const g = particlesRef.current.geometry
      ;(g.attributes.position as THREE.Float32BufferAttribute).needsUpdate = true
      ;(g.attributes.color as THREE.Float32BufferAttribute).needsUpdate = true
    }
  })

  return <points ref={particlesRef} geometry={geo} material={mat} />
}

// ════════════════════════════════════════
//  管理端楼栋悬浮工单卡片
// ════════════════════════════════════════

function TicketHoverCard({
  buildingName,
  tickets,
  initialTicketId,
  onClose,
}: {
  buildingName: string
  tickets: Array<{
    id: string
    description: string | null
    imageUrl: string | null
    aiSeverity: string
    status: string
    createdAt: string | null
    reporterName: string | null
    unitNumber: string | null
    apartmentNumber: string | null
  }>
  initialTicketId?: string | null
  onClose?: () => void
}) {
  const initialIdx = initialTicketId
    ? Math.max(0, tickets.findIndex(t => t.id === initialTicketId))
    : 0
  const [idx, setIdx] = useState(initialIdx >= 0 ? initialIdx : 0)
  const [showImg, setShowImg] = useState(true)
  const [imgError, setImgError] = useState(false)

  // 仅当 initialTicketId 变化时同步 idx（不同步 tickets 引用变化，避免用户翻页时被重置）
  useEffect(() => {
    if (initialTicketId) {
      const newIdx = tickets.findIndex(t => t.id === initialTicketId)
      if (newIdx >= 0) setIdx(newIdx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicketId])

  // 切换工单时重置图片状态
  useEffect(() => {
    setImgError(false)
    setShowImg(true)
  }, [idx])

  const t = tickets.length > 0 ? tickets[Math.min(idx, tickets.length - 1)] : null

  if (!t) return null

  const severityColors: Record<string, string> = {
    high: 'bg-red-500',
    mid: 'bg-amber-500',
    low: 'bg-green-500',
  }

  const severityLabels: Record<string, string> = {
    high: '紧急',
    mid: '中等',
    low: '轻微',
    pending: '待处理',
    processing: '处理中',
    done: '已完成',
  }

  const timeStr = t.createdAt
    ? new Date(t.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className="w-[260px] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden select-none">
      {/* 标题栏 */}
      <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-bold flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', severityColors[t.aiSeverity] || 'bg-slate-400')} />
          {buildingName} · {tickets.length}个工单
        </span>
        <div className="flex items-center gap-2">
          {timeStr && <span className="text-[10px] text-slate-400">{timeStr}</span>}
          {onClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs leading-none transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 图片区域 */}
      {t.imageUrl && (
        <div className="relative">
          {showImg ? (
            <div className="px-3 pt-3">
              {imgError ? (
                <div className="w-full h-36 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                  <span className="text-xs text-slate-500">图片加载失败 · {t.description?.slice(0, 12) || '工单现场'}</span>
                </div>
              ) : (
                <img
                  src={t.imageUrl}
                  alt="工单图片"
                  className="w-full h-36 object-cover rounded-lg border border-slate-200"
                  onError={() => setImgError(true)}
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowImg(true)}
              className="w-full px-3 pt-2"
            >
              <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-200 transition-colors">
                <span className="text-xs text-slate-500">点击查看现场照片</span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* 工单内容 */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('px-1.5 py-0.5 rounded text-[10px] text-white font-medium', severityColors[t.aiSeverity] || 'bg-slate-400')}>
            {severityLabels[t.aiSeverity] || t.aiSeverity}
          </span>
          <span className="text-xs text-slate-500">
            {severityLabels[t.status] || t.status}
          </span>
        </div>
        <p className="text-sm text-slate-700 mb-2 leading-relaxed">{t.description || '暂无描述'}</p>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {t.reporterName && <span>报修人：{t.reporterName}</span>}
          {t.unitNumber && t.apartmentNumber && (
            <span>{t.unitNumber}单元{t.apartmentNumber}</span>
          )}
        </div>
      </div>

      {/* 切换按钮 */}
      {tickets.length > 1 && (
        <div className="flex border-t border-slate-200">
          <button
            onClick={() => setIdx(i => (i - 1 + tickets.length) % tickets.length)}
            className="flex-1 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            ← 上一个
          </button>
          <span className="w-px bg-slate-200" />
          <button
            onClick={() => setIdx(i => (i + 1) % tickets.length)}
            className="flex-1 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            下一个 →
          </button>
        </div>
      )}

      {/* 页码指示 */}
      {tickets.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-2">
          {tickets.map((_, i) => (
            <span
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                i === idx ? 'bg-slate-800' : 'bg-slate-300',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════
//  场景容器
// ════════════════════════════════════════

function Scene({
  role, residentInfo, tickets, focusTicketId, onFocusComplete,
  hoveredBuilding, setHoveredBuilding, setTooltipPos, selectedBuilding, setSelectedBuilding,
  reportedTickets, buildings,
}: {
  role: 'resident' | 'admin'
  residentInfo?: CommunityMap3DProps['residentInfo']
  tickets?: CommunityMap3DProps['tickets']
  focusTicketId?: string | null
  onFocusComplete?: () => void
  hoveredBuilding: BuildingData | null
  setHoveredBuilding: (b: BuildingData | null) => void
  setTooltipPos: (pos: { x: number; y: number }) => void
  selectedBuilding: BuildingData | null
  setSelectedBuilding: (b: BuildingData | null) => void
  reportedTickets?: CommunityMap3DProps['reportedTickets']
  buildings: BuildingData[]
}) {
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 2, 0)
      controlsRef.current.update()
    }
  }, [])

  const handleHover = useCallback((b: BuildingData, e: any) => {
    setHoveredBuilding(b)
    if (e.nativeEvent) setTooltipPos({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
  }, [setHoveredBuilding, setTooltipPos])
  const handleUnhover = useCallback(() => setHoveredBuilding(null), [setHoveredBuilding])
  const handleClick = useCallback((b: BuildingData) => {
    if (role === 'admin') setSelectedBuilding(selectedBuilding?.id === b.id ? null : b)
  }, [role, selectedBuilding, setSelectedBuilding])

  // 外部触发的聚焦逻辑（如工单列表点"查看详情"）
  const focusCompleteRef = useRef<(() => void) | null>(null)
  const [activeFocusTicketId, setActiveFocusTicketId] = useState<string | null>(null)

  // 居民端：上报工单后楼栋闪动（只闪动 3 次）
  const [isFlashing, setIsFlashing] = useState(false)
  const prevTicketCount2 = useRef<number>(0)

  useEffect(() => {
    const count = reportedTickets?.length ?? 0
    if (count > prevTicketCount2.current && residentInfo) {
      setIsFlashing(true)
      let tick = 0
      const interval = setInterval(() => {
        tick++
        if (tick >= 6) {
          setIsFlashing(false)
          clearInterval(interval)
        } else {
          // 偶数 tick 显示，奇数 tick 隐藏，产生闪烁效果
          setIsFlashing(tick % 2 === 0)
        }
      }, 250)
      return () => {
        clearInterval(interval)
        setIsFlashing(false)
      }
    }
    prevTicketCount2.current = count
  }, [reportedTickets?.length, residentInfo])

  // 居民端：气泡自动消失（取最新的工单，显示 3 秒）
  const [visibleBubbleId, setVisibleBubbleId] = useState<string | null>(null)
  const prevBubbleCount = useRef<number>(0)

  useEffect(() => {
    const tickets = reportedTickets ?? []
    if (tickets.length > prevBubbleCount.current && tickets.length > 0) {
      const latestId = tickets[tickets.length - 1].id
      setVisibleBubbleId(latestId)
      const timer = setTimeout(() => setVisibleBubbleId(null), 3000)
      prevBubbleCount.current = tickets.length
      return () => clearTimeout(timer)
    }
    prevBubbleCount.current = tickets.length
  }, [reportedTickets])

  useEffect(() => {
    onFocusComplete && (focusCompleteRef.current = onFocusComplete)
  }, [onFocusComplete])

  useEffect(() => {
    if (!focusTicketId || role !== 'admin' || !tickets) return

    // 找到对应工单
    const targetTicket = tickets.find(t => t.id === focusTicketId)
    if (!targetTicket || !targetTicket.buildingName) return

    // 映射 DB 名到 mock 名
    const candidates = [
      targetTicket.buildingName,
      targetTicket.buildingName.replace('号', ''),
      targetTicket.buildingName.replace('号楼', '栋'),
      targetTicket.buildingName === '社区服务中心' ? '物业中心' : null,
    ].filter(Boolean) as string[]

    const found = buildings.find(b => candidates.includes(b.name))
    if (!found) return

    setActiveFocusTicketId(focusTicketId)
    setSelectedBuilding(found)
  }, [focusTicketId, role, tickets])

  return (
    <>
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} minDistance={4} maxDistance={22} maxPolarAngle={Math.PI / 2 + 0.4} minPolarAngle={0.25} />

      {/* 灯光 */}
      <ambientLight intensity={1.6} color="#8899bb" />
      <directionalLight position={[18, 22, 6]} intensity={3.5} color="#fffaf0" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-near={0.5} shadow-camera-far={60} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-bias={-0.0004} />
      <directionalLight position={[-8, 4, -6]} intensity={1.0} color="#aaccee" />
      <hemisphereLight args={['#aaccee', '#7a9e5a', 0.6]} />

      <fog attach="fog" args={['#d0dcc5', 18, 50]} />
      <color attach="background" args={['#c8d8c0']} />

      <Ground />
      <CrossRoad pos={[0, 0, 0]} />
      <CrossRoad pos={[-11.5, 0, 0]} />
      <CrossRoad pos={[11.5, 0, 0]} />
      <CrossRoad pos={[0, 0, -11.5]} />
      <CrossRoad pos={[0, 0, 11.5]} />
      <CrossRoad pos={[-11.5, 0, -11.5]} />
      <CrossRoad pos={[-11.5, 0, 11.5]} />
      <CrossRoad pos={[11.5, 0, -11.5]} />
      <CrossRoad pos={[11.5, 0, 11.5]} />

      <Trees />

      {/* 围墙 */}
      <PerimeterWall />

      {/* 大门 */}
      <CommunityGate position={[0, 0, 12.7]} />

      {/* 路灯 */}
      {[[-6, 0, 1.5], [6, 0, 1.5], [-17, 0, 1.5], [17, 0, 1.5], [-6, 0, -1.5], [6, 0, -1.5], [-17, 0, -1.5], [17, 0, -1.5], [-1.5, 0, -6], [1.5, 0, -6], [-1.5, 0, 6], [1.5, 0, 6]].map((p, i) => (
        <StreetLamp key={`lamp${i}`} position={p as [number, number, number]} />
      ))}

      {/* 花坛 */}
      {[[-6, 0, 6], [6, 0, 6], [-6, 0, -6], [6, 0, -6], [0, 0, 8], [0, 0, -8]].map((p, i) => (
        <FlowerBed key={`fb${i}`} position={p as [number, number, number]} radius={0.7 + i * 0.05} />
      ))}

      {/* 长凳 */}
      {[[-5.5, 0, 7.2], [5.5, 0, 7.2], [-5.5, 0, -7.2], [5.5, 0, -7.2]].map((p, i) => (
        <Bench key={`bench${i}`} position={p as [number, number, number]} rotation={i < 2 ? 0 : Math.PI} />
      ))}

      {/* 停车场 */}
      <ParkingLot position={[-9.5, 0, 10]} />
      <ParkingLot position={[9.5, 0, 10]} />

      {/* 灌木丛 */}
      {[[-8, 0, 8.5], [8, 0, 8.5], [-8, 0, -8.5], [8, 0, -8.5]].map((p, i) => (
        <Bush key={`bush${i}`} position={p as [number, number, number]} />
      ))}

      {/* 建筑 */}
      {buildings.map(b => (
        <ResidentialBuilding key={b.id} def={b} onHover={handleHover} onUnhover={handleUnhover} onClick={handleClick} />
      ))}

      {/* 管理端点击楼栋弹出工单弹窗 */}
      {role === 'admin' && selectedBuilding && tickets && (() => {
        const mockName = selectedBuilding.name
        const dbNameCandidates = [
          mockName,
          mockName.replace('栋', '号楼'),
          mockName.replace('中心', '服务中心'),
          mockName === '物业中心' ? '社区服务中心' : null,
        ].filter(Boolean) as string[]

        const buildingTickets = tickets
          .filter(t => t.buildingName && dbNameCandidates.includes(t.buildingName))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

        if (buildingTickets.length === 0) return null

        const x = selectedBuilding.posX * SCALE
        const z = selectedBuilding.posZ * SCALE

        return (
          <Html position={[x, 6.8, z]} center style={{ pointerEvents: 'auto' }}>
            <TicketHoverCard
              buildingName={mockName}
              tickets={buildingTickets}
              initialTicketId={activeFocusTicketId}
              onClose={() => {
                setSelectedBuilding(null)
                setActiveFocusTicketId(null)
                focusCompleteRef.current?.()
              }}
            />
          </Html>
        )
      })()}

      {/* 居民端 "我" 的 3D 定位标记 */}
      {residentInfo && (
        <Html position={[residentInfo.posX * SCALE, 7.2, residentInfo.posZ * SCALE]} center style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-green-300 animate-ping opacity-40" />
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50 border-2 border-white">
                <span className="text-white text-[10px] font-bold">我</span>
              </div>
            </div>
            <div className="bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
              {residentInfo.buildingName}
              {residentInfo.unitNumber && residentInfo.apartmentNumber
                ? ` ${residentInfo.unitNumber}单元${residentInfo.apartmentNumber}`
                : ''}
            </div>
          </div>
        </Html>
      )}

      {/* 居民端：楼栋闪动效果（上报后触发） */}
      {residentInfo && isFlashing && (
        <mesh
          position={[residentInfo.posX * SCALE, 3.5, residentInfo.posZ * SCALE]}
        >
          <boxGeometry args={[4, 7, 3.5]} />
          <meshBasicMaterial color="#ff4444" transparent opacity={0.3} depthTest={false} />
        </mesh>
      )}

      {/* 居民端：上报工单气泡（仅显示 3 秒） */}
      {reportedTickets && reportedTickets.length > 0 && (
        <>
          {reportedTickets.map((ticket) => {
            if (ticket.id !== visibleBubbleId) return null
            return (
              <Html
                key={ticket.id}
                position={[ticket.posX * SCALE, 8.5, ticket.posZ * SCALE]}
                center
                style={{ pointerEvents: 'none' }}
              >
                <div className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg shadow-red-500/40 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <span className="font-bold">🚨 已上报</span>
                  <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-red-500 -mb-[11px]" />
                </div>
              </Html>
            )
          })}
        </>
      )}

      <AlertParticles buildings={buildings} />
    </>
  )
}

// ════════════════════════════════════════
//  导出
// ════════════════════════════════════════

export function CommunityMap3D({ role, residentInfo, tickets, focusTicketId, onFocusComplete, reportedTickets, residentTickets }: CommunityMap3DProps) {
  const [mounted, setMounted] = useState(false)
  const [hoveredBuilding, setHoveredBuilding] = useState<BuildingData | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingData | null>(null)
  const [progressTicket, setProgressTicket] = useState<{
    id: string; title: string; status: string
  } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // 根据 tickets 表中的 building_id + ai_severity 动态设置楼栋颜色
  // severity 优先级: high > mid > low
  const SEVERITY_RANK: Record<string, number> = { high: 3, mid: 2, low: 1 }

  const buildingMaxSeverity = useMemo(() => {
    const map = new Map<string, 'high' | 'mid' | 'low'>()
    const resolveName = (bn: string | null) => {
      if (!bn) return null
      const m = bn.match(/^(\d+)号楼$/)
      return m ? `${m[1]}栋` : bn
    }
    const feed = (bn: string | null, severity: string) => {
      const name = resolveName(bn)
      if (!name) return
      const rank = SEVERITY_RANK[severity] ?? 0
      const prevRank = SEVERITY_RANK[map.get(name) ?? ''] ?? 0
      if (rank > prevRank) map.set(name, severity as 'high' | 'mid' | 'low')
    }
    // 管理端工单
    tickets?.forEach(t => feed(t.buildingName, t.aiSeverity))
    // 居民端工单
    residentTickets?.forEach(t => feed(t.buildingName, t.aiSeverity))
    // 上报工单
    reportedTickets?.forEach(t => feed(t.buildingName, t.severity))
    return map
  }, [tickets, residentTickets, reportedTickets])

  const buildings = useMemo(() =>
    mockBuildings.map(b => {
      const severity = buildingMaxSeverity.get(b.name)
      return {
        ...b,
        alertLevel: severity ?? ('normal' as const),
        hasPendingTickets: !!severity,
      }
    }),
    [buildingMaxSeverity],
  )

  if (!mounted) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50">
      <span className="text-sm text-slate-400">加载地图中…</span>
    </div>
  )

  const residentBuilding = residentInfo ?? null

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 z-0">
      <Canvas
        shadows
        camera={{ position: [12, 12, 16], fov: 45, near: 0.5, far: 80 }}
        style={{ background: 'linear-gradient(180deg, #b8d4e8 0%, #c8d8c0 50%, #e0d8c0 100%)' }}
        onPointerMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
      >
        <Scene
          role={role}
          residentInfo={residentInfo}
          tickets={tickets}
          focusTicketId={focusTicketId}
          onFocusComplete={onFocusComplete}
          hoveredBuilding={hoveredBuilding}
          setHoveredBuilding={setHoveredBuilding}
          setTooltipPos={setTooltipPos}
          selectedBuilding={selectedBuilding}
          setSelectedBuilding={setSelectedBuilding}
          reportedTickets={reportedTickets}
          buildings={buildings}
        />
      </Canvas>
      </div>

      {/* 居民端标题 */}
      {role === 'resident' && (
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-sm">
            {residentBuilding
              ? `我的楼栋：${residentBuilding.buildingName}${residentBuilding.unitNumber && residentBuilding.apartmentNumber ? ` ${residentBuilding.unitNumber}单元${residentBuilding.apartmentNumber}` : ''}`
              : '我的楼栋：暂未设置'}
          </h3>
          <p className="text-xs text-slate-500">社区地图 · 居民视角</p>
        </div>
      )}

      {/* 居民端定位 - 无楼栋信息时显示居中提示 */}
      {role === 'resident' && !residentBuilding && (
        <div className="absolute pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
          <div className="relative w-10 h-10 opacity-40">
            <div className="absolute inset-0 rounded-full bg-slate-400 flex items-center justify-center shadow-md">
              <span className="text-white text-[10px] font-bold">?</span>
            </div>
          </div>
        </div>
      )}

      {/* 居民端报修卡 */}
      {role === 'resident' && (
        <div className="absolute right-3 top-14 w-64 glass-white rounded-xl shadow-lg border border-white/60 z-50">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary-600 rounded-full" />
              <h4 className="font-semibold text-slate-800 text-sm">我的报修记录</h4>
            </div>
          </div>
          <div className="p-2.5 space-y-2 max-h-64 overflow-y-auto">
            {residentTickets && residentTickets.length > 0 ? (
              residentTickets.map(ticket => (
                <div key={ticket.id} className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-700 line-clamp-2 font-medium">
                    {ticket.title || ticket.description || '无描述'}
                  </p>
                  {ticket.title && ticket.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{ticket.description}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('zh-CN') : ''}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]', statusColors[ticket.status])}>{statusLabels[ticket.status]}</span>
                    <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]', severityColors[ticket.aiSeverity])}>{severityLabels[ticket.aiSeverity]}</span>
                  </div>
                  <button
                    onClick={() => setProgressTicket({ id: ticket.id, title: ticket.title || ticket.description || '无描述', status: ticket.status })}
                    className="mt-2 w-full text-center text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 py-1 rounded transition-colors"
                  >
                    进度查询 &gt;
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">暂无报修记录</p>
            )}
          </div>
        </div>
      )}

      {/* 进度查询弹窗 */}
      {progressTicket && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center" onClick={() => setProgressTicket(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-[380px] max-w-[90vw] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">工单进度</h3>
              <button
                onClick={() => setProgressTicket(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5 line-clamp-1">{progressTicket.title}</p>

            {/* 进度条 */}
            <div className="relative">
              {/* 节点与标签 */}
              <div className="flex justify-between relative z-10">
                {PROGRESS_STAGES.map((stage, idx) => {
                  const currentStage = STATUS_TO_STAGE[progressTicket.status] ?? 0
                  const isDone = idx <= currentStage
                  const isCurrent = idx === currentStage
                  return (
                    <div key={stage} className="flex flex-col items-center" style={{ width: '25%' }}>
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                          isDone ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30' : 'bg-slate-200 text-slate-400',
                          isCurrent && 'ring-4 ring-primary-200 scale-110',
                        )}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <span
                        className={cn(
                          'text-[10px] mt-1.5 text-center',
                          isDone ? 'text-primary-700 font-semibold' : 'text-slate-400',
                        )}
                      >
                        {stage}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* 连接线背景 */}
              <div className="absolute top-4 left-0 right-0 h-1 bg-slate-200 -z-0 rounded" style={{ margin: '0 12%' }}>
                <div
                  className="h-full bg-primary-500 rounded transition-all duration-500"
                  style={{ width: `${((STATUS_TO_STAGE[progressTicket.status] ?? 0) / (PROGRESS_STAGES.length - 1)) * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setProgressTicket(null)}
              className="mt-6 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 管理端标题 */}
      {role === 'admin' && (
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-sm">智慧社区综合调度中心</h3>
          <p className="text-xs text-slate-500">拖拽旋转 · 滚轮缩放 · 右键平移</p>
        </div>
      )}

      {/* 管理端图例 */}
      {role === 'admin' && (
        <div className="absolute bottom-4 left-4 bg-white/85 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-slate-200">
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /><span className="text-slate-600">紧急</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" style={{ animationDuration: '1.4s' }} /><span className="text-slate-600">中等</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" style={{ animationDuration: '2s' }} /><span className="text-slate-600">一般</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /><span className="text-slate-600">正常</span></div>
          </div>
        </div>
      )}

      {/* 悬浮 Tooltip */}
      {hoveredBuilding && (
        <div className="fixed pointer-events-none z-50 bg-slate-900/90 text-white px-3 py-2 rounded-lg shadow-lg border border-slate-700 text-sm" style={{ left: tooltipPos.x, top: tooltipPos.y - 60, transform: 'translateX(-50%)' }}>
          <div className="font-bold">{hoveredBuilding.name} — {alertLevelLabels[hoveredBuilding.alertLevel]}</div>
          <div className="text-xs text-slate-300">{hoveredBuilding.hasPendingTickets ? '有待处理工单' : '暂无工单'}</div>
        </div>
      )}

    </div>
  )
}
