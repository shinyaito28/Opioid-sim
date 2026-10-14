// Existing body-size estimate, moved unchanged out of the previous App.
export function estimateGrowth(age,gender) {
  if(age<0)return {height:50,weight:3};
  if(age===0)return {height:60,weight:6};
  if(age<=12)return {height:Math.round(75+(age-1)*6.8),weight:Math.round(9+(age-1)*3.0)};
  if(age<=18){
    if(gender==='male')return {height:Math.min(Math.round(150+(age-12)*3.5),171),weight:Math.min(Math.round(40+(age-12)*4.2),65)};
    return {height:Math.min(Math.round(150+(age-12)*1.5),158),weight:Math.min(Math.round(40+(age-12)*2.0),65)};
  }
  return gender==='male'?{height:171,weight:68}:{height:158,weight:53};
}
