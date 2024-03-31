window.som = () => {

  const V_ID_ATTR_NAME = 'v-id';

  getColor = (i) => {
    // colors need to be dark enough for white text to be visible
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ff8000', '#ff0080', '#80ff00', '#0080ff', '#8000ff', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#808080', '#c0c0c0', '#8080ff', '#80ff80', '#ff8080', '#ff80ff', '#80ffff', '#ff80c0', '#80c0ff'];
    return colors[i % colors.length];
  }

  function querySelectorAllIncludingShadowDom(selector, startElement) {
    let elements = Array.from(startElement.querySelectorAll(selector));
    const shadowRoots = elements.filter((el) => el.shadowRoot);
    const iframes = elements.filter((el) => el.tagName === 'IFRAME');

    for (const root of shadowRoots) {
      elements = [
        ...elements,
        ...querySelectorAllIncludingShadowDom(selector, root.shadowRoot)
      ]
    }

    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const iframeElements = querySelectorAllIncludingShadowDom(selector, iframeDoc);
        iframeElements.forEach(el => el.iframeOwner = iframe);
        elements = [
          ...elements,
          ...querySelectorAllIncludingShadowDom(selector, iframeDoc)
        ]
      } catch (e) {
        console.error('Error in iframe', e);
      }
    }
    
    return elements;
  }

  function getTextsInElement(el) {
    let text = '';
    el.childNodes.forEach(node => {
      if (node.nodeType === 3) {
        text += node.textContent;
      } else {
        text += getTextsInElement(node);
      }
    });
    return text;
  }

  getDefaltElementAttrs = (el) => {
    const tagName = el.tagName;
    const hint = el.getAttribute('v-id');
    const text = getTextsInElement(el).substring(0, 50);
    const ariaLabel = el.getAttribute('aria-label');
    const role = el.getAttribute('role');
    return { tagName, hint, text, ariaLabel, role };
  }

  getInputElementAttrs = (el) => {
    const placeholder = el.getAttribute('placeholder');
    const ariaLabel = el.getAttribute('aria-label');
    const tagName = el.tagName;
    const type = el.getAttribute('type');
    const closestLabel = el.closest('label')?.innerText;
    const name = el.getAttribute('name');
    const hint = el.getAttribute('v-id');
    return { placeholder, ariaLabel, tagName, type, closestLabel, name, hint };
  }

  getElementsAttrs = (el) => {
    if (elementIsInput(el)) {
      return getInputElementAttrs(el);
    }
    return getDefaltElementAttrs(el);
  }

  const getSequenceFromNum = (num) => {
    const startChar = 'a'.charCodeAt(0);
    const alphabetLength = 26;
    let length = 1;
    let range = alphabetLength;
    while (num > range) {
      num -= range;
      length++;
      range = alphabetLength ** length;
    }
    let result = '';
    num--;
    for (let i = 0; i < length; i++) {
      result = String.fromCharCode(startChar + (num % alphabetLength)) + result;
      num = Math.floor(num / alphabetLength);
    }

    return result;
  }

  function isTrulyVisible(el) {
    var rect = el.getBoundingClientRect();
    var isVisible = rect.top >= 0 && rect.left >= 0 && (rect.top) <= (window.innerHeight || document.documentElement.clientHeight) && (rect.left) <= (window.innerWidth || document.documentElement.clientWidth);
    
    if (!isVisible) {
      return false;
    }
    let tempEl = el;
  
    while (tempEl) {
      const elComputedStyle = window.getComputedStyle(el);
      const elDisplay = elComputedStyle.getPropertyValue('display');
      const elVisibility = elComputedStyle.getPropertyValue('visibility');
      const elOpacity = elComputedStyle.getPropertyValue('opacity');
      const exitingId = tempEl.getAttribute('v-id');
      const acceptedRoles = ['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox', 'radio', 'switch'];
      const elementIsInteractive = ['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(el.tagName) || (el.getAttribute('role') && acceptedRoles.includes(el.getAttribute('role')));

      if (exitingId && !elementIsInteractive) {
        return false;
      }
      if (elDisplay === 'none' || elVisibility === 'hidden' || elOpacity === '0') {
        
        return false;
      }
      isFirstChild = false;
      tempEl = tempEl.parentElement;
    }
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var elementAtCenter = (el.iframeOwner?.contentDocument || el.iframeOwner?.contentWindow.document || document).elementFromPoint(centerX, centerY);
    const isInShadowDom = elementAtCenter?.shadowRoot && (() => {
      const maxDepth = 10; // prevent infinite loops
      let depth = 0;
      let tempElement = elementAtCenter?.shadowRoot || null;
      while (tempElement !== null && depth < maxDepth) {
        depth++;
        if (tempElement.contains(el)) {
          return true;
        }
        const deeperElement = tempElement.elementFromPoint(centerX, centerY)?.shadowRoot || null;
        tempElement = deeperElement == tempElement ? null : deeperElement;
      }
      return false;
    })();
    if(el.getAttribute('data-pid') === '36'){
      console.log('element', elementAtCenter);
    }
    return (elementAtCenter === el || el?.contains(elementAtCenter) || isInShadowDom);
  }

  function isClickeable(el) {
    const cursor = window.getComputedStyle(el).cursor;
    // firs check if it is a button or an a tag
    const acceptedRoles = ['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox', 'radio', 'switch', 'treeitem', 'gridcell'];
    if (['A', 'BUTTON', 'SELECT'].includes(el.tagName)
      || (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.getAttribute('type')))
      || (el.getAttribute('role') && acceptedRoles.includes(el.getAttribute('role')))
      || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === ''
    ) {
      return true;
    }
    return cursor === 'pointer' || cursor === 'text';
  }

  function elementIsScrollable(element) {
    const overflowY = window.getComputedStyle(element).overflowY;
    const overflowX = window.getComputedStyle(element).overflowX;
    const isScrollableY = overflowY !== 'visible' && overflowY !== 'hidden' && element.scrollHeight > element.clientHeight;
    const isScrollableX = overflowX !== 'visible' && overflowX !== 'hidden' && element.scrollWidth > element.clientWidth;

    // check if is has overflowed content
    const contentHeight = element.scrollHeight;
    const contentWidth = element.scrollWidth;

    const isOverflowedY = contentHeight > element.clientHeight;
    const isOverflowedX = contentWidth > element.clientWidth;

    return (isScrollableY && isOverflowedY) || (isScrollableX && isOverflowedX);
  }

  elementIsInput = (element) => {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) && !(['button', 'submit', 'reset'].includes(element.getAttribute('type')));
  }

  // delete all prev spans
  document.querySelectorAll('span.vision-hint').forEach(e => e.remove());
  document.querySelectorAll('.vision-segment').forEach(e => e.remove());
  // delete all prev v-id attributes and v-scroll-id
  document.querySelectorAll('[v-id]').forEach(el => el.removeAttribute('v-id'));
  document.querySelectorAll('[v-scroll-id]').forEach(el => el.removeAttribute('v-scroll-id'));

  let hintId = 1;
  let jsonMap = {};
  const allElements = querySelectorAllIncludingShadowDom('*', document);
  allElements.forEach((element, i) => {

    if(element.getAttribute('data-pid') === '36') {
      console.log('element', element);
    }
    // ignore input type hidden
    if (element.type === 'hidden') {
      return;
    }
    // ignore invisible elements or elements without cursor pointer ot non scrollable elements
    if (!isTrulyVisible(element) || (!isClickeable(element) && !elementIsScrollable(element))) {
      return;
    }
    // get the color
    const color = getColor(hintId);

    const attrName = V_ID_ATTR_NAME;
    const elementRect = {
      top: element.getBoundingClientRect().top,
      left: element.getBoundingClientRect().left,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height
    };
    // add offset if the element is inside an iframe
    if (element.iframeOwner) {
      const iframeRect = element.iframeOwner.getBoundingClientRect();
      elementRect.top += iframeRect.top;
      elementRect.left += iframeRect.left;
    }
    const id = getSequenceFromNum(hintId);
    element.setAttribute(attrName, id);
    const span = document.createElement('span');
    span.setAttribute('class', 'vision-hint');
    span.innerText = id;
    span.setAttribute('style',
      `   top: ${elementRect.top}px; 
          left: ${elementRect.left}px; 
          position: fixed; 
          background-color: ${color} !important;`
    );
    document.querySelector('body').after(span);

    // create an sqquare in the position and size of the element
    const square = document.createElement('div');

    square.setAttribute('style',
      `   top: ${elementRect.top}px; 
          left: ${elementRect.left}px; 
          width: ${elementRect.width}px; 
          height: ${elementRect.height}px; 
          border: dashed 2px ${color};`
    )
    square.classList.add('vision-segment');

    document.querySelector('body').after(square);
    jsonMap[id] = elementRect;
    hintId++;
  });
  window.jsonMap = jsonMap;

  // create a xml map of the elemetes with the unique id

  let xmlMap = '';
  document.querySelectorAll('[v-id]').forEach(el => {
    const attrs = getElementsAttrs(el);
    // traverse the attributes and create the xml map
    let xmlAttrs = '';
    for (const [key, value] of Object.entries(attrs)) {
      if (value) {
        xmlAttrs += ` ${key}="${value}"`;
      }
    }
    xmlMap += `<element${xmlAttrs}></element>`;
  });
  window.xmlMap = xmlMap;
}
window.som();