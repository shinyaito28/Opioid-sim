import {eventDoseValue,markerClock} from '../lib/doseMarkers.js';

// Persistent text below the existing marker rail: no hover, selected marker,
// chart overlay, or changes to the plotted data are needed to read the values.
export default function DoseMarkerValues({groups,events,weight,startTime,color,t}) {
  return <div className="marker-values" data-testid="marker-values" role="list" aria-label={t('markerValues')}>
    {groups.map((group,index)=><div key={group.id} className="marker-value-group" role="listitem"
      data-marker-number={index+1} style={{borderColor:color}}>
      <p className="marker-value-heading"><span>{'#'+(index+1)}</span> {t('entryDrug'+group.events[0].drug,{defaultValue:group.events[0].drug})}</p>
      {group.events.map(event=>{
        const {kind,value}=eventDoseValue(event,events,weight);
        return <p key={event.id} className="marker-value-row" data-event-value-id={event.id}>
          <time>{markerClock(event.time,startTime)}</time>
          <span><span className="marker-value-kind">{t('marker'+kind[0].toUpperCase()+kind.slice(1))}</span>{' '}
            <strong className="marker-numeric">{value}</strong></span>
        </p>;
      })}
    </div>)}
  </div>;
}
