import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react'

import { AppSidebarNav } from './AppSidebarNav'

// sidebar nav config
import navigation from '../_nav'

// 로고 이미지 import (파일이 있으면 사용)
let logoImage = null
try {
  logoImage = require('src/assets/brand/inha-united-logo.png')
} catch (e) {
  // 로고 파일이 없으면 텍스트 로고 사용
}

const AppSidebar = () => {
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)

  return (
    <CSidebar
      className="border-end"
      colorScheme="dark"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: 'set', sidebarShow: visible })
      }}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand to="/" className="d-flex align-items-center">
          {logoImage ? (
            <>
              <img
                src={logoImage}
                alt="Inha-United"
                height={32}
                className="sidebar-brand-full"
              />
              <img
                src={logoImage}
                alt="IU"
                height={32}
                className="sidebar-brand-narrow"
              />
            </>
          ) : (
            <>
              <span className="sidebar-brand-full fs-5 fw-bold text-white">
                🤖 Inha-United
              </span>
              <span className="sidebar-brand-narrow fs-5 fw-bold text-white">
                IU
              </span>
            </>
          )}
        </CSidebarBrand>
        <CCloseButton
          className="d-lg-none"
          dark
          onClick={() => dispatch({ type: 'set', sidebarShow: false })}
        />
      </CSidebarHeader>
      <AppSidebarNav items={navigation} />
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler
          onClick={() => dispatch({ type: 'set', sidebarUnfoldable: !unfoldable })}
        />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
