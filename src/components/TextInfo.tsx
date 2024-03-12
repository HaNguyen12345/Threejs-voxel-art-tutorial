import styled from "@emotion/styled";
import { FC, useState } from "react";

import {sceneHandler} from '../core/scene-handler';
import * as OBC from 'openbim-components';


export const TextInfo: FC = () => {
  const Button = styled.button`
    position: absolute;
    background-color: #55ff55;
    padding: 20px;
    left: 50px;
    top: 50px;
  `;

  const TextDiv = styled.div`
    position: absolute;
    background-color: white;
    padding: 20px;
    left: 50px;
    top: 120px;
  `;


  const [sceneParamDatas, setSceneParamDatas] = useState<string>("");
  
  const onClickShowSceneParam = () => {

    const viewer = sceneHandler.viewer;
    if(viewer){
      const _components = viewer._components;
      const scene = _components.scene.get();
      setSceneParamDatas(JSON.stringify(scene.toJSON));
    }else
      setSceneParamDatas("TESTです");
  };

  return (
    <>
      <Button onClick={onClickShowSceneParam}>SCENE 確認</Button>
      {sceneParamDatas && <TextDiv>{sceneParamDatas}</TextDiv>}
    </>
  );
};
