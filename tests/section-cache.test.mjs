import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {atLevel,section,sliceMetrics} from '../geometry.js';
import {cachedCut} from '../section-cache.js';

const plane=[0,1,0],origin=[0,0,0];

test('a new scene owns its cut vertices, face metadata, morph targets and progressive rim',()=>{
 const source=new T.BoxGeometry(2,4,2);source.userData.specimen=true;
 const first=section(source,plane,origin),standard=first[0].geo.attributes.position.getY(0);
 first[0].geo.attributes.position.setY(0,999);
 first[0].face.userData.canal=true;
 first[0].geo.morphAttributes.position=[first[0].geo.attributes.position.clone()];
 first[0].outline.setDrawRange(0,0);first[0].outline.attributes.position.setX(0,777);
 for(const p of first)for(const g of [p.geo,p.face,p.outline])g.dispose();
 const second=section(source,plane,origin);
 assert.equal(second[0].geo.attributes.position.getY(0),standard);
 assert.equal(second[0].face.userData.canal,undefined);
 assert.equal(second[0].geo.morphAttributes.position,undefined);
 assert.equal(second[0].outline.drawRange.count,Infinity);
 assert.notEqual(second[0].outline.attributes.position.getX(0),777);
 source.translate(.125,0,0);
 const moved=section(source,plane,origin);
 assert.equal(moved[0].geo.attributes.position.getX(0),second[0].geo.attributes.position.getX(0)+.125);
 source.dispose();
});

test('source disposal removes remembered cut templates even when source is retained',()=>{
 const source=new T.BoxGeometry(1,1,1);let builds=0;
 const build=()=>{builds++;return [{geo:source.clone(),face:source.clone(),outline:source.clone()}];};
 cachedCut(source,'test',build);cachedCut(source,'test',build);assert.equal(builds,1);
 source.dispose();cachedCut(source,'test',build);assert.equal(builds,2);
 source.dispose();
});

test('a native axis slab returns the same cross-section as scanning the complete index',()=>{
 const g=new T.SphereGeometry(1,192,96);g.computeBoundingBox();const ordinary=g.clone();
 g.userData={specimen:true};ordinary.userData={};
 for(let axis=0;axis<3;axis++)for(const fraction of [.125,.42,.5,.981]){
  assert.deepEqual(atLevel(g,axis,fraction),atLevel(ordinary,axis,fraction));
 }
 const o=new T.Vector3(0,.3,0),n=new T.Vector3(0,1,0),u=new T.Vector3(1,0,0);
 const first=sliceMetrics(g,o,n,u);first.centre.y=10;
 assert.equal(sliceMetrics(g,o,n,u).centre.y,.3);
 g.translate(0,.25,0);ordinary.translate(0,.25,0);
 assert.deepEqual(atLevel(g,1,.5),atLevel(ordinary,1,.5));
 g.dispose();ordinary.dispose();
});
